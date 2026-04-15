/**
 * audit-competitor-url — Crawls and audits a competitor URL
 * Runs SEO/GEO checks + SERP position tracking via DataForSEO
 * Updates competitor_tracked_urls with results
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');
const getAuth = () => `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;

Deno.serve(handleRequest(async (req) => {
  const { competitorUrl, competitorDomain, trackedSiteId, referenceDomain } = await req.json();
  if (!competitorUrl || !competitorDomain || !trackedSiteId) {
    return jsonError('competitorUrl, competitorDomain, trackedSiteId required', 400);
  }

  const sb = getServiceClient();

  // Mark as crawling
  await sb.from('competitor_tracked_urls')
    .update({ crawl_status: 'crawling' })
    .eq('tracked_site_id', trackedSiteId)
    .eq('competitor_url', competitorUrl);

  try {
    // 1. Get reference site's target keywords
    const { data: siteData } = await sb.from('tracked_sites')
      .select('market_sector, products_services, brand_name, primary_language')
      .eq('id', trackedSiteId)
      .maybeSingle();

    const lang = siteData?.primary_language || 'fr';
    const sector = siteData?.market_sector || '';
    const products = siteData?.products_services || '';

    // Get keywords from keyword_universe for this site
    const { data: kwData } = await sb.from('keyword_universe')
      .select('keyword, search_volume, current_position')
      .eq('tracked_site_id', trackedSiteId)
      .order('search_volume', { ascending: false })
      .limit(20);

    const targetKeywords = (kwData || []).map((k: any) => k.keyword);

    // 2. Check competitor SERP positions on target keywords
    const serpPositions: { keyword: string; position: number; volume: number }[] = [];
    
    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD && targetKeywords.length > 0) {
      // Batch keywords in groups of 10
      const batches = [];
      for (let i = 0; i < Math.min(targetKeywords.length, 20); i += 10) {
        batches.push(targetKeywords.slice(i, i + 10));
      }

      for (const batch of batches) {
        const tasks = batch.map((kw: string) => ({
          keyword: kw,
          location_code: 2250,
          language_code: lang === 'fr' ? 'fr' : 'en',
          depth: 30,
        }));

        try {
          const r = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
            method: 'POST',
            headers: { 'Authorization': getAuth(), 'Content-Type': 'application/json' },
            body: JSON.stringify(tasks),
            signal: AbortSignal.timeout(15000),
          });

          if (r.ok) {
            trackPaidApiCall('audit-competitor-url', 'dataforseo', 'serp/organic/competitor-positions');
            const data = await r.json();
            for (const task of (data.tasks || [])) {
              const kw = task?.data?.keyword;
              const items = task?.result?.[0]?.items || [];
              const match = items.find((item: any) =>
                item.type === 'organic' &&
                item.domain &&
                item.domain.replace(/^www\./, '').toLowerCase() === competitorDomain.toLowerCase()
              );
              if (match && kw) {
                const vol = (kwData || []).find((k: any) => k.keyword === kw)?.search_volume || 0;
                serpPositions.push({ keyword: kw, position: match.rank_absolute || 0, volume: vol });
              }
            }
          }
        } catch (e) {
          console.warn('SERP batch error:', e);
        }
      }
    }

    // 3. Run lightweight SEO check via check-pagespeed
    let seoScore: number | null = null;
    let geoScore: number | null = null;

    try {
      const psiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/check-pagespeed`;
      const psiRes = await fetch(psiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ url: competitorUrl, lang }),
        signal: AbortSignal.timeout(20000),
      });
      if (psiRes.ok) {
        const psiData = await psiRes.json();
        seoScore = psiData?.data?.scores?.seo ?? psiData?.data?.mobile?.scores?.seo ?? null;
      }
    } catch (e) {
      console.warn('PSI check failed for competitor:', e);
    }

    try {
      const geoUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/check-geo`;
      const geoRes = await fetch(geoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ url: competitorUrl, lang }),
        signal: AbortSignal.timeout(20000),
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        geoScore = geoData?.data?.totalScore ?? geoData?.data?.overallScore ?? null;
      }
    } catch (e) {
      console.warn('GEO check failed for competitor:', e);
    }

    // 4. Compute semantic relevance
    const semanticRelevance: any = { score: null, matchedKeywords: 0, totalKeywords: targetKeywords.length };
    if (serpPositions.length > 0 && targetKeywords.length > 0) {
      semanticRelevance.matchedKeywords = serpPositions.length;
      // Score = % of target keywords where competitor ranks in top 30
      semanticRelevance.score = Math.round((serpPositions.length / targetKeywords.length) * 100);
    }

    // 5. Update the competitor record
    await sb.from('competitor_tracked_urls')
      .update({
        crawl_status: 'done',
        last_crawl_at: new Date().toISOString(),
        seo_score: seoScore != null ? Math.round(seoScore) : null,
        geo_score: geoScore != null ? Math.round(geoScore) : null,
        serp_positions: serpPositions,
        semantic_relevance: semanticRelevance,
        audit_data: { seoScore, geoScore, serpCount: serpPositions.length, analyzedAt: new Date().toISOString() },
      })
      .eq('tracked_site_id', trackedSiteId)
      .eq('competitor_url', competitorUrl);

    console.log(`✅ [audit-competitor-url] Done for ${competitorDomain}: SEO=${seoScore}, GEO=${geoScore}, SERP=${serpPositions.length} kws`);
    return jsonOk({ success: true, seoScore, geoScore, serpPositions: serpPositions.length, semanticRelevance });

  } catch (error) {
    console.error('❌ [audit-competitor-url] Error:', error);
    await sb.from('competitor_tracked_urls')
      .update({ crawl_status: 'error' })
      .eq('tracked_site_id', trackedSiteId)
      .eq('competitor_url', competitorUrl);
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}));
