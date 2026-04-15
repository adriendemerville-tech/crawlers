/**
 * audit-competitor-url — Crawls and audits a competitor URL
 * Runs SEO/GEO checks + SERP position tracking via DataForSEO
 * Computes GEO-specific metrics: chunkability, schema, structure, quotability, EEAT, semantic richness
 * Updates competitor_tracked_urls with results
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { analyzeHtmlFull } from '../_shared/matriceHtmlAnalysis.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');
const getAuth = () => `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;

/* ── GEO metric helpers ──────────────────────────────────── */

function computeChunkability(html: string): { score: number; paragraphs: number; avgLength: number; hasToc: boolean } {
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Count meaningful paragraphs
  const pTags = text.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const paragraphs = pTags.map(p => p.replace(/<[^>]+>/g, '').trim()).filter(p => p.length > 30);
  const avgLength = paragraphs.length > 0 ? Math.round(paragraphs.reduce((s, p) => s + p.length, 0) / paragraphs.length) : 0;
  const hasToc = /table[- ]?of[- ]?contents|sommaire|table des matières/i.test(html);

  // Score: short paragraphs (100-300 chars) are ideal for LLM chunking
  let score = 0;
  if (paragraphs.length >= 5) score += 25;
  if (avgLength >= 80 && avgLength <= 350) score += 30;
  else if (avgLength > 0) score += 10;
  if (hasToc) score += 15;
  // Headers create chunk boundaries
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length;
  if (h2Count >= 3) score += 15;
  if (h3Count >= 2) score += 10;
  // Lists and tables help chunk isolation
  const listCount = (html.match(/<[uo]l[\s>]/gi) || []).length;
  if (listCount >= 1) score += 5;
  return { score: Math.min(100, score), paragraphs: paragraphs.length, avgLength, hasToc };
}

function computeStructureScore(hd: ReturnType<typeof analyzeHtmlFull>): { score: number; details: Record<string, boolean | number> } {
  let score = 0;
  const has = {
    h1: hd.h1Count === 1,
    h2: hd.h2Count >= 2,
    h3: hd.h3Count >= 1,
    faq: hd.hasFAQSection,
    lists: hd.listCount >= 1,
    tables: hd.tableCount >= 1,
    toc: hd.hasTLDR,
  };
  if (has.h1) score += 20;
  if (has.h2) score += 20;
  if (has.h3) score += 10;
  if (has.faq) score += 20;
  if (has.lists) score += 10;
  if (has.tables) score += 10;
  if (has.toc) score += 10;
  return { score: Math.min(100, score), details: { ...has, h2Count: hd.h2Count, h3Count: hd.h3Count } };
}

function computeQuotability(html: string): { score: number; quotableCount: number; samples: string[] } {
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const quotable = sentences.filter(s => {
    const t = s.trim();
    if (t.length < 40 || t.length > 250) return false;
    // Contains data or strong assertion
    if (/\d+\s*%/.test(t)) return true;
    if (/selon|d'après|étude|research|study|report/i.test(t)) return true;
    if (/leader|meilleur|best|top|premier|first|unique/i.test(t)) return true;
    if (/permet|enables|offers|propose|garantit/i.test(t)) return true;
    return false;
  });

  const samples = quotable.slice(0, 3).map(s => s.trim());
  let score = 0;
  if (quotable.length >= 5) score = 90;
  else if (quotable.length >= 3) score = 70;
  else if (quotable.length >= 1) score = 40;
  return { score, quotableCount: quotable.length, samples };
}

function computeEeatSignals(hd: ReturnType<typeof analyzeHtmlFull>): { score: number; signals: Record<string, boolean> } {
  const signals = {
    authorBio: hd.hasAuthorBio,
    authorInJsonLd: hd.hasAuthorInJsonLd,
    organizationSchema: hd.schemaEntities.hasOrganization,
    personSchema: hd.schemaEntities.hasPerson,
    reviewSchema: hd.schemaEntities.hasReview,
    sameAs: hd.hasSameAs,
    socialLinks: hd.hasSocialLinks,
    linkedIn: hd.hasLinkedInLinks,
    caseStudies: hd.hasCaseStudies,
    dataRich: hd.dataDensityScore >= 30,
  };
  const count = Object.values(signals).filter(Boolean).length;
  return { score: Math.min(100, Math.round(count / Object.keys(signals).length * 100)), signals };
}

function computeSemanticRichness(hd: ReturnType<typeof analyzeHtmlFull>): { score: number; wordCount: number; dataDensity: number; schemaCount: number } {
  let score = 0;
  if (hd.wordCount >= 1500) score += 30;
  else if (hd.wordCount >= 800) score += 20;
  else if (hd.wordCount >= 300) score += 10;
  if (hd.dataDensityScore >= 50) score += 20;
  else if (hd.dataDensityScore >= 20) score += 10;
  if (hd.schemaCount >= 3) score += 20;
  else if (hd.schemaCount >= 1) score += 10;
  if (hd.externalLinksCount >= 3) score += 10;
  if (hd.internalLinksCount >= 5) score += 10;
  if (hd.statisticCount >= 3) score += 10;
  return { score: Math.min(100, score), wordCount: hd.wordCount, dataDensity: hd.dataDensityScore, schemaCount: hd.schemaCount };
}

/* ── Main handler ──────────────────────────────────── */

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

    // Get keywords from keyword_universe for this site
    const { data: kwData } = await sb.from('keyword_universe')
      .select('keyword, search_volume, current_position')
      .eq('tracked_site_id', trackedSiteId)
      .order('search_volume', { ascending: false })
      .limit(20);

    const targetKeywords = (kwData || []).map((k: any) => k.keyword);

    // 2. Fetch competitor HTML for GEO analysis
    let htmlContent = '';
    try {
      const htmlResp = await fetch(competitorUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0)' },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
      if (htmlResp.ok) htmlContent = await htmlResp.text();
    } catch (e) {
      console.warn('[audit-competitor] HTML fetch failed:', e);
    }

    // 3. Compute GEO metrics from HTML
    let geoMetrics: any = null;
    if (htmlContent.length > 100) {
      const hd = analyzeHtmlFull(htmlContent, competitorUrl);
      const chunkability = computeChunkability(htmlContent);
      const structure = computeStructureScore(hd);
      const quotability = computeQuotability(htmlContent);
      const eeat = computeEeatSignals(hd);
      const semanticRichness = computeSemanticRichness(hd);

      geoMetrics = {
        chunkability,
        schema: {
          hasJsonLd: hd.hasSchemaOrg,
          schemaTypes: hd.schemaTypes,
          schemaCount: hd.schemaCount,
          schemaFieldCount: hd.schemaFieldCount,
          hasGraph: hd.schemaHasGraph,
        },
        metaDescription: {
          present: hd.hasMetaDesc,
          length: hd.metaDescLength,
          content: hd.metaDescContent.slice(0, 200),
        },
        structure,
        quotability,
        eeat,
        semanticRichness,
        title: { present: hd.hasTitle, length: hd.titleLength, content: hd.titleContent },
        og: { present: hd.hasOg, tags: hd.ogTags },
        canonical: { present: hd.hasCanonical, url: hd.canonicalUrl },
        faqWithSchema: hd.hasFAQWithSchema,
        wordCount: hd.wordCount,
      };
    }

    // 4. Check competitor SERP positions on target keywords
    const serpPositions: { keyword: string; position: number; volume: number }[] = [];

    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD && targetKeywords.length > 0) {
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

    // 5. Run lightweight SEO check via check-pagespeed
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

    // 6. Compute semantic relevance
    const semanticRelevance: any = { score: null, matchedKeywords: 0, totalKeywords: targetKeywords.length };
    if (serpPositions.length > 0 && targetKeywords.length > 0) {
      semanticRelevance.matchedKeywords = serpPositions.length;
      semanticRelevance.score = Math.round((serpPositions.length / targetKeywords.length) * 100);
    }

    // 7. Update the competitor record
    await sb.from('competitor_tracked_urls')
      .update({
        crawl_status: 'done',
        last_crawl_at: new Date().toISOString(),
        seo_score: seoScore != null ? Math.round(seoScore) : null,
        geo_score: geoScore != null ? Math.round(geoScore) : null,
        serp_positions: serpPositions,
        semantic_relevance: semanticRelevance,
        audit_data: {
          seoScore,
          geoScore,
          serpCount: serpPositions.length,
          geoMetrics,
          analyzedAt: new Date().toISOString(),
        },
      })
      .eq('tracked_site_id', trackedSiteId)
      .eq('competitor_url', competitorUrl);

    console.log(`✅ [audit-competitor-url] Done for ${competitorDomain}: SEO=${seoScore}, GEO=${geoScore}, SERP=${serpPositions.length} kws, geoMetrics=${!!geoMetrics}`);
    return jsonOk({ success: true, seoScore, geoScore, serpPositions: serpPositions.length, semanticRelevance, hasGeoMetrics: !!geoMetrics });

  } catch (error) {
    console.error('❌ [audit-competitor-url] Error:', error);
    await sb.from('competitor_tracked_urls')
      .update({ crawl_status: 'error' })
      .eq('tracked_site_id', trackedSiteId)
      .eq('competitor_url', competitorUrl);
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}));
