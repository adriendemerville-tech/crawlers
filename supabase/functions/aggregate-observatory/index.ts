import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: aggregate-observatory
 * 
 * Aggregates sectoral data from:
 * 1. audit-expert-seo (technical audit results stored in audits table)
 * 2. audit-strategique-ia (strategic audit data)
 * 3. crawl-site (multi-page crawl from site_crawls + crawl_pages)
 * 
 * Called periodically or after each audit/crawl to update observatory_sectors.
 * All data is anonymized — no URLs or domains stored, only aggregated metrics.
 */

Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient()

    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ─── 1. Aggregate from Expert Audits (audits table) ───
    const { data: audits } = await supabase
      .from('audits')
      .select('audit_data, sector, created_at')
      .gte('created_at', `${period}-01`)
      .not('audit_data', 'is', null)

    const sectorMapExpert = new Map<string, any[]>()
    for (const audit of audits || []) {
      const sector = audit.sector || 'default'
      if (!sectorMapExpert.has(sector)) sectorMapExpert.set(sector, [])
      sectorMapExpert.get(sector)!.push(audit.audit_data)
    }

    for (const [sector, dataList] of sectorMapExpert) {
      const n = dataList.length
      if (n === 0) continue

      const agg = {
        json_ld_rate: 0, sitemap_rate: 0, robots_txt_rate: 0,
        meta_description_rate: 0, open_graph_rate: 0, canonical_rate: 0,
        hreflang_rate: 0, https_rate: 0, mobile_friendly_rate: 0,
        schema_org_rate: 0,
        avg_load_time_ms: 0, avg_ttfb_ms: 0, avg_fcp_ms: 0,
        avg_lcp_ms: 0, avg_cls: 0,
        avg_seo_score: 0, avg_broken_links: 0,
        avg_images_without_alt: 0, avg_word_count: 0,
      }

      for (const d of dataList) {
        // Boolean fields from expert audit data
        if (d?.structuredData?.jsonLd || d?.has_json_ld) agg.json_ld_rate++
        if (d?.has_sitemap || d?.sitemap) agg.sitemap_rate++
        if (d?.has_robots_txt || d?.robotsTxt) agg.robots_txt_rate++
        if (d?.metaDescription || d?.has_meta_description) agg.meta_description_rate++
        if (d?.openGraph || d?.has_open_graph) agg.open_graph_rate++
        if (d?.canonical || d?.has_canonical) agg.canonical_rate++
        if (d?.hreflang || d?.has_hreflang) agg.hreflang_rate++
        if (d?.https || d?.has_https) agg.https_rate++
        if (d?.mobileFriendly || d?.is_mobile_friendly) agg.mobile_friendly_rate++
        if (d?.structuredData?.schemaOrg || d?.has_schema_org) agg.schema_org_rate++

        // Numeric fields
        agg.avg_load_time_ms += (d?.loadTime || d?.load_time_ms || 0)
        agg.avg_ttfb_ms += (d?.ttfb || d?.ttfb_ms || 0)
        agg.avg_fcp_ms += (d?.fcp || d?.fcp_ms || 0)
        agg.avg_lcp_ms += (d?.lcp || d?.lcp_ms || 0)
        agg.avg_cls += (d?.cls || d?.cls_score || 0)
        agg.avg_seo_score += (d?.score || d?.seo_score || 0)
        agg.avg_broken_links += (d?.brokenLinks?.total || d?.broken_links_count || 0)
        agg.avg_images_without_alt += (d?.imagesWithoutAlt || d?.images_without_alt || 0)
        agg.avg_word_count += (d?.wordCount || d?.word_count || 0)
      }

      await supabase.from('observatory_sectors').upsert({
        sector,
        source: 'expert_audit',
        period,
        total_scans: n,
        json_ld_rate: Math.round((agg.json_ld_rate / n) * 100),
        sitemap_rate: Math.round((agg.sitemap_rate / n) * 100),
        robots_txt_rate: Math.round((agg.robots_txt_rate / n) * 100),
        meta_description_rate: Math.round((agg.meta_description_rate / n) * 100),
        open_graph_rate: Math.round((agg.open_graph_rate / n) * 100),
        canonical_rate: Math.round((agg.canonical_rate / n) * 100),
        hreflang_rate: Math.round((agg.hreflang_rate / n) * 100),
        https_rate: Math.round((agg.https_rate / n) * 100),
        mobile_friendly_rate: Math.round((agg.mobile_friendly_rate / n) * 100),
        schema_org_rate: Math.round((agg.schema_org_rate / n) * 100),
        avg_load_time_ms: Math.round(agg.avg_load_time_ms / n),
        avg_ttfb_ms: Math.round(agg.avg_ttfb_ms / n),
        avg_fcp_ms: Math.round(agg.avg_fcp_ms / n),
        avg_lcp_ms: Math.round(agg.avg_lcp_ms / n),
        avg_cls: +(agg.avg_cls / n).toFixed(3),
        avg_word_count: Math.round(agg.avg_word_count / n),
        avg_images_without_alt: +(agg.avg_images_without_alt / n).toFixed(1),
        avg_broken_links: +(agg.avg_broken_links / n).toFixed(1),
        avg_seo_score: Math.round(agg.avg_seo_score / n),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sector,source,period' })
    }

    // ─── 2. Aggregate from Strategic Audits (audit_recommendations_registry) ───
    const { data: stratRecs } = await supabase
      .from('audit_recommendations_registry')
      .select('domain, category, priority, audit_type, created_at')
      .eq('audit_type', 'strategic')
      .gte('created_at', `${period}-01`)

    if (stratRecs && stratRecs.length > 0) {
      // Group by domain to infer sector (we use 'all' since sector isn't in strategic)
      const strategicCount = stratRecs.length
      const criticalCount = stratRecs.filter(r => r.priority === 'critical').length
      const importantCount = stratRecs.filter(r => r.priority === 'important').length
      const categories = stratRecs.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      await supabase.from('observatory_sectors').upsert({
        sector: 'all',
        source: 'strategic_audit',
        period,
        total_scans: strategicCount,
        raw_data: {
          critical_recommendations: criticalCount,
          important_recommendations: importantCount,
          categories_distribution: categories,
          unique_domains: new Set(stratRecs.map(r => r.domain)).size,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sector,source,period' })
    }

    // ─── 3. Aggregate from Multi-Page Crawls (site_crawls + crawl_pages) ───
    const { data: crawls } = await supabase
      .from('site_crawls')
      .select('id, domain, avg_score, crawled_pages, created_at')
      .eq('status', 'completed')
      .gte('created_at', `${period}-01`)

    if (crawls && crawls.length > 0) {
      const crawlIds = crawls.map(c => c.id)

      // Fetch all pages for these crawls (batched to avoid 1000 row limit)
      let allPages: any[] = []
      for (let i = 0; i < crawlIds.length; i += 50) {
        const batch = crawlIds.slice(i, i + 50)
        const { data: pages } = await supabase
          .from('crawl_pages')
          .select('has_schema_org, has_canonical, has_hreflang, has_og, word_count, images_without_alt, images_total, internal_links, external_links, broken_links, seo_score, http_status, h1, title, meta_description')
          .in('crawl_id', batch)
        if (pages) allPages = allPages.concat(pages)
      }

      const np = allPages.length
      if (np > 0) {
        const crawlAgg = {
          schema_org: 0, canonical: 0, hreflang: 0, og: 0,
          word_count: 0, img_no_alt: 0, broken: 0, seo_score: 0,
          has_h1: 0, has_title: 0, has_meta: 0,
        }

        for (const p of allPages) {
          if (p.has_schema_org) crawlAgg.schema_org++
          if (p.has_canonical) crawlAgg.canonical++
          if (p.has_hreflang) crawlAgg.hreflang++
          if (p.has_og) crawlAgg.og++
          if (p.h1) crawlAgg.has_h1++
          if (p.title) crawlAgg.has_title++
          if (p.meta_description) crawlAgg.has_meta++
          crawlAgg.word_count += (p.word_count || 0)
          crawlAgg.img_no_alt += (p.images_without_alt || 0)
          crawlAgg.broken += (Array.isArray(p.broken_links) ? p.broken_links.length : 0)
          crawlAgg.seo_score += (p.seo_score || 0)
        }

        await supabase.from('observatory_sectors').upsert({
          sector: 'all',
          source: 'crawl',
          period,
          total_scans: crawls.length,
          schema_org_rate: Math.round((crawlAgg.schema_org / np) * 100),
          canonical_rate: Math.round((crawlAgg.canonical / np) * 100),
          hreflang_rate: Math.round((crawlAgg.hreflang / np) * 100),
          open_graph_rate: Math.round((crawlAgg.og / np) * 100),
          meta_description_rate: Math.round((crawlAgg.has_meta / np) * 100),
          avg_word_count: Math.round(crawlAgg.word_count / np),
          avg_images_without_alt: +(crawlAgg.img_no_alt / np).toFixed(1),
          avg_broken_links: +(crawlAgg.broken / np).toFixed(1),
          avg_seo_score: Math.round(crawlAgg.seo_score / np),
          raw_data: {
            total_pages_crawled: np,
            total_sites_crawled: crawls.length,
            avg_pages_per_site: Math.round(np / crawls.length),
            title_rate: Math.round((crawlAgg.has_title / np) * 100),
            h1_rate: Math.round((crawlAgg.has_h1 / np) * 100),
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sector,source,period' })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      period,
      sources: {
        expert_audits: sectorMapExpert.size,
        strategic_audits: (stratRecs?.length || 0) > 0 ? 1 : 0,
        crawls: crawls?.length || 0,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Observatory aggregation error:', error)
    return jsonError(error.message, 500)
  }
}));