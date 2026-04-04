import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: backlink-scanner
 * 
 * Scans DataForSEO backlinks for the top N pages (by internal PageRank)
 * from a completed crawl. Results stored in crawl_page_backlinks + semantic_nodes.
 * 
 * POST { crawl_id, tracked_site_id, top_n?: number }
 * Returns: { scanned: number, results: [...] }
 */

interface PageToScan {
  url: string
  path: string
  nodeId?: string
  pageAuthority?: number
}

interface BacklinkResult {
  url: string
  path: string
  referring_domains: number
  backlinks_total: number
  domain_rank_avg: number
  top_anchors: string[]
  top_sources: Array<{ domain: string; rank: number }>
}

async function scanBacklinks(
  pages: PageToScan[],
  crawlId: string,
  trackedSiteId: string,
  dfAuth: string,
  supabase: any
): Promise<BacklinkResult[]> {
  const results: BacklinkResult[] = []

  // Process sequentially to avoid rate limits (max 10 calls)
  for (const page of pages) {
    try {
      // Call DataForSEO backlinks/summary for this specific URL
      const resp = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
        method: 'POST',
        headers: { 'Authorization': dfAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: page.url, internal_list_limit: 0, backlinks_filters: ["dofollow", "=", "true"] }])
      })

      if (!resp.ok) {
        console.warn(`[backlink-scanner] DataForSEO error for ${page.url}: ${resp.status}`)
        continue
      }

      await trackPaidApiCall('backlink-scanner', 'dataforseo', 'backlinks/summary/live', page.url)
      const data = await resp.json()
      const summary = data.tasks?.[0]?.result?.[0]

      if (!summary) continue

      // Get top anchors
      let topAnchors: string[] = []
      try {
        const anchorResp = await fetch('https://api.dataforseo.com/v3/backlinks/anchors/live', {
          method: 'POST',
          headers: { 'Authorization': dfAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ target: page.url, limit: 5, order_by: ["referring_domains,desc"] }])
        })
        if (anchorResp.ok) {
          await trackPaidApiCall('backlink-scanner', 'dataforseo', 'backlinks/anchors/live', page.url)
          const anchorData = await anchorResp.json()
          topAnchors = (anchorData.tasks?.[0]?.result?.[0]?.items || [])
            .slice(0, 5)
            .map((a: any) => a.anchor || '')
            .filter(Boolean)
        }
      } catch { /* non-blocking */ }

      // Get top referring domains
      let topSources: Array<{ domain: string; rank: number }> = []
      try {
        const refResp = await fetch('https://api.dataforseo.com/v3/backlinks/referring_domains/live', {
          method: 'POST',
          headers: { 'Authorization': dfAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ target: page.url, limit: 5, order_by: ["rank,desc"] }])
        })
        if (refResp.ok) {
          await trackPaidApiCall('backlink-scanner', 'dataforseo', 'backlinks/referring_domains/live', page.url)
          const refData = await refResp.json()
          topSources = (refData.tasks?.[0]?.result?.[0]?.items || [])
            .slice(0, 5)
            .map((r: any) => ({ domain: r.domain || '', rank: r.rank || 0 }))
            .filter((r: any) => r.domain)
        }
      } catch { /* non-blocking */ }

      const result: BacklinkResult = {
        url: page.url,
        path: page.path,
        referring_domains: summary.referring_domains || 0,
        backlinks_total: summary.backlinks || 0,
        domain_rank_avg: topSources.length > 0
          ? topSources.reduce((s, r) => s + r.rank, 0) / topSources.length
          : 0,
        top_anchors: topAnchors,
        top_sources: topSources,
      }

      results.push(result)

      // Store in crawl_page_backlinks
      await supabase.from('crawl_page_backlinks').upsert({
        crawl_id: crawlId,
        url: page.url,
        path: page.path,
        referring_domains: result.referring_domains,
        backlinks_total: result.backlinks_total,
        domain_rank_avg: result.domain_rank_avg,
        top_anchors: result.top_anchors,
        top_sources: result.top_sources,
        page_authority_internal: page.pageAuthority || 0,
      }, { onConflict: 'crawl_id,url' })

      // Update semantic_nodes if we have a nodeId
      if (page.nodeId) {
        await supabase.from('semantic_nodes').update({
          external_backlinks: {
            referring_domains: result.referring_domains,
            backlinks_total: result.backlinks_total,
            domain_rank_avg: result.domain_rank_avg,
            top_anchors: result.top_anchors,
            top_sources: result.top_sources,
            scanned_at: new Date().toISOString(),
          }
        }).eq('id', page.nodeId)
      }

      // Small delay between calls
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.warn(`[backlink-scanner] Error scanning ${page.url}:`, err)
    }
  }

  return results
}

Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient()
    const { crawl_id, tracked_site_id: providedSiteId, top_n = 10 } = await req.json()

    // Fetch identity card for strategic context (competitors, sector)
    let siteContext: any = null

    if (!crawl_id) {
      return jsonError('crawl_id required', 400)
    }

    // Look up tracked_site_id from crawl if not provided
    let tracked_site_id = providedSiteId
    if (!tracked_site_id) {
      const { data: crawl } = await supabase.from('site_crawls').select('domain, user_id').eq('id', crawl_id).single()
      if (crawl) {
        const { data: site } = await supabase.from('tracked_sites').select('id').eq('domain', crawl.domain).eq('user_id', crawl.user_id).maybeSingle()
        tracked_site_id = site?.id
      }
    }

    // Load identity card once we have tracked_site_id
    if (tracked_site_id) {
      siteContext = await getSiteContext(supabase, { trackedSiteId: tracked_site_id })
      if (siteContext) {
        console.log(`[backlink-scanner] 📇 Identity: sector="${siteContext.market_sector}", competitors="${(siteContext as any).competitors || 'none'}"`)
      }
    }

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Unauthorized', 401)
    }

    const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN')
    const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD')
    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return jsonError('DataForSEO credentials not configured', 500)
    }

    const dfAuth = 'Basic ' + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)

    // 1. Get top N pages by page_authority from semantic_nodes
    const { data: topPages, error: nodesErr } = await supabase
      .from('semantic_nodes')
      .select('id, url, title, page_authority')
      .eq('tracked_site_id', tracked_site_id)
      .order('page_authority', { ascending: false })
      .limit(top_n)

    if (nodesErr || !topPages?.length) {
      // Fallback: get top pages from crawl_pages by seo_score
      const { data: crawlPages } = await supabase
        .from('crawl_pages')
        .select('url, path, seo_score')
        .eq('crawl_id', crawl_id)
        .eq('http_status', 200)
        .order('seo_score', { ascending: false })
        .limit(top_n)

      if (!crawlPages?.length) {
        return jsonOk({ scanned: 0, results: [], message: 'No pages found' })
      }

      // Use crawl_pages as fallback
      const results = await scanBacklinks(crawlPages.map(p => ({ url: p.url, path: p.path || '/' })), crawl_id, tracked_site_id, dfAuth, supabase)
      return jsonOk({ scanned: results.length, results })
    }

    // Extract paths from URLs
    const pagesWithPaths = topPages.map(p => {
      try {
        const u = new URL(p.url)
        return { url: p.url, path: u.pathname, nodeId: p.id, pageAuthority: p.page_authority }
      } catch {
        return { url: p.url, path: '/', nodeId: p.id, pageAuthority: p.page_authority }
      }
    })

    const results = await scanBacklinks(pagesWithPaths, crawl_id, tracked_site_id, dfAuth, supabase)

    return jsonOk({ scanned: results.length, results })
  } catch (err) {
    console.error('[backlink-scanner] Error:', err)
    await trackEdgeFunctionError('backlink-scanner', err instanceof Error ? err.message : String(err))
    return jsonError(err instanceof Error ? err.message : 'Internal error', 500)
  }
}))
