import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * calculate-page-priority
 * 
 * Calculates a Score de Priorité d'Optimisation (SPO) 0-100 for each page
 * of a tracked site by aggregating signals from:
 * - GSC (CTR gap, position, impressions, click trends)
 * - GA4 (sessions, engagement, bounce rate, revenue)
 * - Crawl (word count, SEO score, depth, broken links, orphan status)
 * - Semantic nodes (internal link centrality, PageRank)
 * - Indexation checks (indexed/not indexed)
 * - Backlinks (referring domains, authority)
 * - SERP/keyword data (keyword difficulty, volume)
 * 
 * Weights:
 *   CTR gap:          20%
 *   Conversion value: 18%
 *   Quick-win position: 15%
 *   Maillage centrality: 12%
 *   Indexation penalty: 10%
 *   Content decay:     10%
 *   Backlink authority:  8%
 *   Cannibalization:     7%
 */

const WEIGHTS = {
  ctr_gap: 0.20,
  conversion: 0.18,
  quick_win: 0.15,
  maillage: 0.12,
  indexation: 0.10,
  content_decay: 0.10,
  backlinks: 0.08,
  cannibalization: 0.07,
};

// ─── Normalize 0-100 ───
function norm(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

// ─── CTR Gap score: high impressions + low CTR = high opportunity ───
function scoreCtrGap(impressions: number, ctr: number, position: number): number {
  if (impressions < 10) return 0;
  // Expected CTR by position (rough Google benchmarks)
  const expectedCtr: Record<number, number> = {
    1: 0.30, 2: 0.15, 3: 0.10, 4: 0.07, 5: 0.05,
    6: 0.04, 7: 0.03, 8: 0.025, 9: 0.02, 10: 0.018,
  };
  const posRound = Math.min(10, Math.max(1, Math.round(position)));
  const expected = expectedCtr[posRound] || 0.015;
  const gap = Math.max(0, expected - ctr);
  // Scale by impressions volume (log scale)
  const volumeFactor = Math.min(1, Math.log10(impressions + 1) / 4);
  return Math.min(100, (gap / expected) * 100 * volumeFactor);
}

// ─── Quick-win: positions 4-20 have highest ROI ───
function scoreQuickWin(position: number | null, impressions: number): number {
  if (!position || position < 1) return 0;
  if (impressions < 5) return 0;
  // Sweet spot: 4-15
  if (position >= 4 && position <= 10) return 90 + norm(impressions, 10, 1000) * 0.1;
  if (position >= 11 && position <= 15) return 70 + norm(impressions, 10, 500) * 0.1;
  if (position >= 16 && position <= 20) return 50;
  if (position >= 2 && position <= 3) return 40; // Already good, less upside
  if (position === 1) return 10; // Already #1
  if (position > 20 && position <= 50) return 30;
  return 5;
}

// ─── Conversion value: revenue + engagement ───
function scoreConversion(
  revenue: number,
  sessions: number,
  engagementRate: number,
  bounceRate: number,
): number {
  let score = 0;
  // Revenue (log-scaled)
  if (revenue > 0) score += Math.min(60, Math.log10(revenue + 1) * 20);
  // Engagement (high engagement = valuable page)
  score += engagementRate * 25;
  // Sessions volume
  score += Math.min(15, Math.log10(sessions + 1) * 5);
  // Bounce penalty (high bounce on high-traffic = wasted potential)
  if (sessions > 50 && bounceRate > 0.7) score += 15; // This is an OPPORTUNITY
  return Math.min(100, score);
}

// ─── Maillage centrality ───
function scoreMaillage(
  internalLinksIn: number,
  internalLinksOut: number,
  pageAuthority: number,
  depth: number,
  isOrphan: boolean,
): number {
  if (isOrphan) return 95; // Orphan pages = high priority to integrate
  let score = 0;
  // Low internal links = underlinked
  if (internalLinksIn < 3) score += 40;
  else if (internalLinksIn < 5) score += 20;
  // Deep pages with authority = should be surfaced
  if (depth > 3 && pageAuthority > 0.3) score += 25;
  // High authority but few outgoing = juice hoarder
  if (pageAuthority > 0.5 && internalLinksOut < 2) score += 15;
  // Balance
  score += norm(1 / (internalLinksIn + 1), 0, 0.5) * 20;
  return Math.min(100, score);
}

// ─── Content decay: old + underperforming ───
function scoreContentDecay(
  wordCount: number,
  seoScore: number,
  lastModified: string | null,
  positionTrend: number, // negative = declining
): number {
  let score = 0;
  // Thin content
  if (wordCount < 300) score += 35;
  else if (wordCount < 600) score += 15;
  // Low SEO score
  score += norm(200 - seoScore, 0, 200) * 0.25 * 100 * 0.01;
  // Staleness
  if (lastModified) {
    const ageMonths = (Date.now() - new Date(lastModified).getTime()) / (30 * 24 * 3600 * 1000);
    if (ageMonths > 12) score += 25;
    else if (ageMonths > 6) score += 15;
  }
  // Position decline bonus
  if (positionTrend < -2) score += 20;
  else if (positionTrend < -1) score += 10;
  return Math.min(100, score);
}

// ─── Indexation penalty ───
function scoreIndexation(isIndexed: boolean, hasContent: boolean): number {
  if (!isIndexed && hasContent) return 100; // Not indexed but has content = critical
  if (!isIndexed) return 60;
  return 0; // Already indexed = no issue
}

// ─── Backlink authority ───
function scoreBacklinks(referringDomains: number, domainRank: number): number {
  // Pages with existing backlinks are MORE valuable to optimize (external validation)
  let score = 0;
  if (referringDomains > 0) {
    score += Math.min(50, referringDomains * 10);
    score += Math.min(30, domainRank * 0.5);
  }
  // Pages with 0 backlinks but good content = opportunity too
  return Math.min(100, score);
}

// ─── Cannibalization detection ───
function scoreCannibalization(
  pageUrl: string,
  keywordPages: Map<string, string[]>,
): { score: number; cannibalizedKeywords: string[] } {
  const cannibalized: string[] = [];
  for (const [keyword, urls] of keywordPages) {
    if (urls.length > 1 && urls.includes(pageUrl)) {
      cannibalized.push(keyword);
    }
  }
  if (cannibalized.length === 0) return { score: 0, cannibalizedKeywords: [] };
  return {
    score: Math.min(100, cannibalized.length * 30),
    cannibalizedKeywords: cannibalized.slice(0, 5),
  };
}

// ─── Generate opportunities text ───
function generateOpportunities(
  breakdown: Record<string, number>,
  signals: Record<string, any>,
): string[] {
  const opps: string[] = [];
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  
  for (const [key, val] of sorted.slice(0, 3)) {
    if (val < 20) continue;
    switch (key) {
      case 'ctr_gap':
        opps.push(`CTR sous-optimal (${(signals.ctr * 100).toFixed(1)}% vs attendu) — Optimiser title/description`);
        break;
      case 'conversion':
        if (signals.bounce_rate > 0.7)
          opps.push(`Taux de rebond élevé (${(signals.bounce_rate * 100).toFixed(0)}%) sur page à trafic — Améliorer le contenu`);
        else if (signals.revenue > 0)
          opps.push(`Page génératrice de revenus (${signals.revenue}€) — Renforcer le positionnement`);
        else
          opps.push(`Bon engagement — Monétiser davantage cette page`);
        break;
      case 'quick_win':
        opps.push(`Position ${signals.position?.toFixed(1)} — Quelques optimisations pour atteindre le Top 5`);
        break;
      case 'maillage':
        if (signals.is_orphan)
          opps.push(`Page orpheline — Créer des liens internes vers cette page`);
        else
          opps.push(`Sous-maillée (${signals.internal_links_in} liens entrants) — Renforcer le maillage`);
        break;
      case 'indexation':
        opps.push(`Page non indexée par Google — Vérifier robots.txt/noindex et soumettre`);
        break;
      case 'content_decay':
        if (signals.word_count < 300)
          opps.push(`Contenu trop court (${signals.word_count} mots) — Enrichir le contenu`);
        else
          opps.push(`Contenu obsolète — Mettre à jour avec des données récentes`);
        break;
      case 'backlinks':
        if (signals.referring_domains > 0)
          opps.push(`${signals.referring_domains} domaines référents — Page validée externement, optimiser pour capitaliser`);
        break;
      case 'cannibalization':
        opps.push(`Cannibalisation détectée sur ${signals.cannibalized_keywords?.length || 0} mot(s)-clé(s) — Fusionner ou différencier`);
        break;
    }
  }
  return opps;
}

Deno.serve(handleRequest(async (req) => {
  const sb = getServiceClient();

  const body = await req.json().catch(() => ({}));
  const { tracked_site_id, user_id, domain } = body;

  if (!tracked_site_id || !user_id || !domain) {
    return jsonError('Missing tracked_site_id, user_id, or domain', 400);
  }

  console.log(`[calculate-page-priority] Starting for ${domain} (site: ${tracked_site_id})`);

  try {
    // ══════════════════════════════════════════
    // Phase 1: Collect all data sources in parallel
    // ══════════════════════════════════════════
    const [
      crawlPagesRes,
      gscRankingsRes,
      ga4TopPagesRes,
      semanticNodesRes,
      indexationRes,
      backlinksRes,
      revenueRes,
    ] = await Promise.all([
      // Crawl pages (latest crawl)
      sb.from('crawl_pages')
        .select('url, word_count, seo_score, crawl_depth, issues, last_modified_header')
        .eq('crawl_id', (
          await sb.from('site_crawls')
            .select('id')
            .eq('tracked_site_id', tracked_site_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data?.id || '00000000-0000-0000-0000-000000000000')
        .limit(500),

      // GSC keyword rankings
      sb.from('gsc_keyword_rankings' as any)
        .select('keyword, page_url, position, clicks, impressions, ctr')
        .eq('tracked_site_id', tracked_site_id)
        .order('impressions', { ascending: false })
        .limit(1000),

      // GA4 top pages
      sb.from('ga4_top_pages' as any)
        .select('page_path, sessions, engagement_rate, bounce_rate')
        .eq('tracked_site_id', tracked_site_id)
        .order('sessions', { ascending: false })
        .limit(500),

      // Semantic nodes (cocoon)
      sb.from('semantic_nodes' as any)
        .select('page_url, page_authority, internal_links_in, internal_links_out, depth')
        .eq('tracked_site_id', tracked_site_id)
        .limit(500),

      // Indexation checks
      sb.from('indexation_checks')
        .select('page_url, verdict, coverage_state')
        .eq('tracked_site_id', tracked_site_id),

      // Backlinks
      sb.from('crawl_page_backlinks' as any)
        .select('page_url, referring_domains, domain_rank')
        .eq('tracked_site_id', tracked_site_id)
        .order('referring_domains', { ascending: false })
        .limit(500),

      // Revenue
      sb.from('revenue_events' as any)
        .select('page_url, amount')
        .eq('tracked_site_id', tracked_site_id)
        .gte('transaction_date', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()),
    ]);

    // ══════════════════════════════════════════
    // Phase 2: Build lookup maps
    // ══════════════════════════════════════════
    const crawlPages = crawlPagesRes.data || [];
    const gscRankings = gscRankingsRes.data || [];
    const ga4Pages = ga4TopPagesRes.data || [];
    const semanticNodes = semanticNodesRes.data || [];
    const indexationChecks = indexationRes.data || [];
    const backlinkData = backlinksRes.data || [];
    const revenueData = revenueRes.data || [];

    console.log(`[calculate-page-priority] Data: crawl=${crawlPages.length}, gsc=${gscRankings.length}, ga4=${ga4Pages.length}, nodes=${semanticNodes.length}, idx=${indexationChecks.length}, bl=${backlinkData.length}`);

    if (crawlPages.length === 0 && gscRankings.length === 0) {
      return jsonOk({ message: 'No page data available', pages_scored: 0 });
    }

    // Collect all unique page URLs
    const allUrls = new Set<string>();
    crawlPages.forEach((p: any) => p.url && allUrls.add(p.url));
    gscRankings.forEach((r: any) => r.page_url && allUrls.add(r.page_url));

    // GSC aggregation per page
    const gscByPage = new Map<string, { impressions: number; clicks: number; ctr: number; position: number; keywords: string[] }>();
    const keywordPages = new Map<string, string[]>(); // keyword -> [page_urls] for cannibalization

    for (const r of gscRankings) {
      if (!r.page_url) continue;
      const existing = gscByPage.get(r.page_url) || { impressions: 0, clicks: 0, ctr: 0, position: 0, keywords: [] };
      existing.impressions += r.impressions || 0;
      existing.clicks += r.clicks || 0;
      existing.keywords.push(r.keyword);
      gscByPage.set(r.page_url, existing);

      // Cannibalization tracking
      if (r.keyword) {
        const pages = keywordPages.get(r.keyword) || [];
        if (!pages.includes(r.page_url)) pages.push(r.page_url);
        keywordPages.set(r.keyword, pages);
      }
    }
    // Compute weighted CTR and position per page
    for (const [url, data] of gscByPage) {
      data.ctr = data.impressions > 0 ? data.clicks / data.impressions : 0;
      // Weighted average position from individual rankings
      const pageRankings = gscRankings.filter((r: any) => r.page_url === url);
      const totalImp = pageRankings.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
      data.position = totalImp > 0
        ? pageRankings.reduce((s: number, r: any) => s + (r.position || 50) * (r.impressions || 0), 0) / totalImp
        : 50;
    }

    // GA4 map (normalize path to full URL)
    const ga4ByPage = new Map<string, { sessions: number; engagement_rate: number; bounce_rate: number }>();
    for (const p of ga4Pages) {
      if (!p.page_path) continue;
      // Try to match by path suffix
      const path = p.page_path.startsWith('/') ? p.page_path : '/' + p.page_path;
      const fullUrl = `https://${domain}${path}`;
      ga4ByPage.set(fullUrl, {
        sessions: p.sessions || 0,
        engagement_rate: p.engagement_rate || 0,
        bounce_rate: p.bounce_rate || 0,
      });
      ga4ByPage.set(path, {
        sessions: p.sessions || 0,
        engagement_rate: p.engagement_rate || 0,
        bounce_rate: p.bounce_rate || 0,
      });
    }

    // Semantic nodes map
    const nodesByPage = new Map<string, any>();
    for (const n of semanticNodes) {
      if (n.page_url) nodesByPage.set(n.page_url, n);
    }

    // Indexation map
    const idxByPage = new Map<string, string>();
    for (const c of indexationChecks) {
      if (c.page_url) idxByPage.set(c.page_url, c.verdict);
    }

    // Backlinks map
    const blByPage = new Map<string, { referring_domains: number; domain_rank: number }>();
    for (const b of backlinkData) {
      if (b.page_url) blByPage.set(b.page_url, { referring_domains: b.referring_domains || 0, domain_rank: b.domain_rank || 0 });
    }

    // Revenue map
    const revByPage = new Map<string, number>();
    for (const r of revenueData) {
      if (!r.page_url) continue;
      revByPage.set(r.page_url, (revByPage.get(r.page_url) || 0) + (r.amount || 0));
    }

    // Crawl map
    const crawlByPage = new Map<string, any>();
    for (const c of crawlPages) {
      if (c.url) crawlByPage.set(c.url, c);
    }

    // ══════════════════════════════════════════
    // Phase 3: Score each page
    // ══════════════════════════════════════════
    const scoredPages: any[] = [];

    for (const pageUrl of allUrls) {
      const gsc = gscByPage.get(pageUrl);
      const crawl = crawlByPage.get(pageUrl);
      const path = new URL(pageUrl, `https://${domain}`).pathname;
      const ga4 = ga4ByPage.get(pageUrl) || ga4ByPage.get(path);
      const node = nodesByPage.get(pageUrl);
      const idxVerdict = idxByPage.get(pageUrl);
      const bl = blByPage.get(pageUrl);
      const revenue = revByPage.get(pageUrl) || 0;

      // Sub-scores
      const ctrGapScore = gsc
        ? scoreCtrGap(gsc.impressions, gsc.ctr, gsc.position)
        : 0;

      const conversionScore = scoreConversion(
        revenue,
        ga4?.sessions || 0,
        ga4?.engagement_rate || 0,
        ga4?.bounce_rate || 0,
      );

      const quickWinScore = gsc
        ? scoreQuickWin(gsc.position, gsc.impressions)
        : 0;

      const maillageScore = node
        ? scoreMaillage(
            node.internal_links_in || 0,
            node.internal_links_out || 0,
            node.page_authority || 0,
            node.depth || 0,
            (node.internal_links_in || 0) === 0,
          )
        : (crawl && crawl.crawl_depth !== undefined
            ? scoreMaillage(0, 0, 0, crawl.crawl_depth, true)
            : 0);

      const indexationScore = idxVerdict !== undefined
        ? scoreIndexation(idxVerdict === 'PASS', (crawl?.word_count || 0) > 100)
        : 0;

      const contentDecayScore = crawl
        ? scoreContentDecay(
            crawl.word_count || 0,
            crawl.seo_score || 0,
            crawl.last_modified_header || null,
            0, // position trend (would need historical data)
          )
        : 0;

      const backlinkScore = bl
        ? scoreBacklinks(bl.referring_domains, bl.domain_rank)
        : 0;

      const { score: cannibalScore, cannibalizedKeywords } = scoreCannibalization(pageUrl, keywordPages);

      // Weighted composite
      const breakdown: Record<string, number> = {
        ctr_gap: Math.round(ctrGapScore),
        conversion: Math.round(conversionScore),
        quick_win: Math.round(quickWinScore),
        maillage: Math.round(maillageScore),
        indexation: Math.round(indexationScore),
        content_decay: Math.round(contentDecayScore),
        backlinks: Math.round(backlinkScore),
        cannibalization: Math.round(cannibalScore),
      };

      const priorityScore = Math.round(
        ctrGapScore * WEIGHTS.ctr_gap +
        conversionScore * WEIGHTS.conversion +
        quickWinScore * WEIGHTS.quick_win +
        maillageScore * WEIGHTS.maillage +
        indexationScore * WEIGHTS.indexation +
        contentDecayScore * WEIGHTS.content_decay +
        backlinkScore * WEIGHTS.backlinks +
        cannibalScore * WEIGHTS.cannibalization
      );

      const signals = {
        impressions: gsc?.impressions || 0,
        clicks: gsc?.clicks || 0,
        ctr: gsc?.ctr || 0,
        position: gsc?.position || null,
        sessions: ga4?.sessions || 0,
        engagement_rate: ga4?.engagement_rate || 0,
        bounce_rate: ga4?.bounce_rate || 0,
        revenue,
        word_count: crawl?.word_count || 0,
        seo_score: crawl?.seo_score || 0,
        depth: crawl?.crawl_depth || node?.depth || 0,
        internal_links_in: node?.internal_links_in || 0,
        internal_links_out: node?.internal_links_out || 0,
        is_orphan: (node?.internal_links_in || 0) === 0,
        is_indexed: idxVerdict === 'PASS',
        referring_domains: bl?.referring_domains || 0,
        cannibalized_keywords: cannibalizedKeywords,
        keywords_count: gsc?.keywords?.length || 0,
      };

      const opportunities = generateOpportunities(breakdown, signals);

      scoredPages.push({
        tracked_site_id,
        user_id,
        domain,
        page_url: pageUrl,
        priority_score: priorityScore,
        breakdown,
        top_opportunities: opportunities,
        signals,
      });
    }

    // Sort by priority
    scoredPages.sort((a, b) => b.priority_score - a.priority_score);

    // ══════════════════════════════════════════
    // Phase 4: Upsert results (top 200)
    // ══════════════════════════════════════════
    const toUpsert = scoredPages.slice(0, 200);

    // Delete old scores for this site
    await sb.from('page_priority_scores')
      .delete()
      .eq('tracked_site_id', tracked_site_id);

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < toUpsert.length; i += 50) {
      const batch = toUpsert.slice(i, i + 50);
      const { error } = await sb.from('page_priority_scores').insert(batch);
      if (error) {
        console.error(`[calculate-page-priority] Insert batch error:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`[calculate-page-priority] Done: ${inserted} pages scored for ${domain}`);

    return jsonOk({
      success: true,
      domain,
      pages_scored: inserted,
      top_5: toUpsert.slice(0, 5).map(p => ({
        url: p.page_url,
        score: p.priority_score,
        top_opportunity: p.top_opportunities[0] || null,
      })),
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[calculate-page-priority] Error:', msg);
    return jsonError(msg, 500);
  }
}));
