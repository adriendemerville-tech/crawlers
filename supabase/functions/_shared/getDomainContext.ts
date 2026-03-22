/**
 * getDomainContext.ts
 *
 * Shared helper that fetches all domain-related data in parallel.
 * Used by cocoon-chat, cocoon-strategist, and ML training functions.
 */

export interface DomainContextResult {
  blocks: string[];
  raw: {
    crawl: any;
    crawlPages: any[];
    audits: any[];
    serp: any[];
    backlinks: any;
    gsc: any[];
    ga4: any[];
    googleAds: any[];
    indexHistory: any[];
    diagnostics: any[];
    strategistRecos: any[];
    anomalyAlerts: any[];
    auditTechnique: any;
    auditStrategique: any;
  };
}

export async function getDomainContext(
  supabase: any,
  domain: string,
  trackedSiteId: string,
  options?: { includeDiagnostics?: boolean; includeRecos?: boolean; maxPages?: number }
): Promise<DomainContextResult> {
  const normalizedDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  const maxPages = options?.maxPages || 50;

  const promises: Promise<any>[] = [
    // 0: crawl
    supabase
      .from('site_crawls')
      .select('id, domain, status, total_pages, crawled_pages, avg_score, ai_summary, created_at, completed_at')
      .eq('domain', normalizedDomain)
      .order('created_at', { ascending: false })
      .limit(3),
    // 1: crawl pages (via latest crawl)
    supabase
      .from('site_crawls')
      .select('id')
      .eq('domain', normalizedDomain)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(async ({ data }: any) => {
        if (!data?.[0]?.id) return { data: null };
        const { data: pages } = await supabase
          .from('crawl_pages')
          .select('url, title, seo_score, word_count, internal_links, external_links, h1, has_noindex, is_indexable, crawl_depth, page_type_override, issues')
          .eq('crawl_id', data[0].id)
          .order('seo_score', { ascending: true })
          .limit(maxPages);
        return { data: pages };
      }),
    // 2: audits
    supabase
      .from('audit_raw_data')
      .select('audit_type, created_at')
      .eq('domain', normalizedDomain)
      .order('created_at', { ascending: false })
      .limit(5),
    // 3: serp
    supabase
      .from('domain_data_cache')
      .select('data_type, result_data, created_at')
      .eq('domain', normalizedDomain)
      .in('data_type', ['serp_kpis', 'keyword_rankings'])
      .order('created_at', { ascending: false })
      .limit(2),
    // 4: backlinks
    supabase
      .from('backlink_snapshots')
      .select('referring_domains, backlinks_total, domain_rank, referring_domains_new, referring_domains_lost, measured_at')
      .eq('tracked_site_id', trackedSiteId)
      .order('measured_at', { ascending: false })
      .limit(1),
    // 5: gsc
    supabase
      .from('gsc_history_log')
      .select('clicks, impressions, ctr, avg_position, top_queries, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(4),
    // 6: ga4
    supabase
      .from('ga4_history_log')
      .select('total_users, sessions, pageviews, bounce_rate, engagement_rate, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(4),
    // 7: index history
    supabase
      .from('crawl_index_history')
      .select('total_pages, indexed_count, noindex_count, gsc_indexed_count, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(4),
    // 8: google ads
    supabase
      .from('google_ads_history_log')
      .select('impressions, clicks, ctr, conversions, conversion_rate, cost_micros, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(4),
    // 9: anomaly alerts
    supabase
      .from('anomaly_alerts')
      .select('metric_name, metric_source, severity, direction, change_pct, description, detected_at')
      .eq('tracked_site_id', trackedSiteId)
      .eq('is_dismissed', false)
      .order('detected_at', { ascending: false })
      .limit(10),
    // 10: audit technique raw data (latest)
    supabase
      .from('audit_raw_data')
      .select('raw_payload, audit_type, created_at')
      .eq('domain', normalizedDomain)
      .in('audit_type', ['expert', 'technical'])
      .order('created_at', { ascending: false })
      .limit(1),
    // 11: audit stratégique raw data (latest)
    supabase
      .from('audit_raw_data')
      .select('raw_payload, audit_type, created_at')
      .eq('domain', normalizedDomain)
      .in('audit_type', ['strategic', 'strategique'])
      .order('created_at', { ascending: false })
      .limit(1),
  ];

  // Optional: diagnostics
  if (options?.includeDiagnostics) {
    promises.push(
      supabase
        .from('cocoon_diagnostic_results')
        .select('diagnostic_type, findings, scores, created_at')
        .eq('tracked_site_id', trackedSiteId)
        .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(4)
    );
  }

  // Optional: strategist recommendations
  if (options?.includeRecos) {
    promises.push(
      supabase
        .from('strategist_recommendations')
        .select('action_type, title, url, status, impact_score, created_at')
        .eq('tracked_site_id', trackedSiteId)
        .order('created_at', { ascending: false })
        .limit(50)
    );
  }

  const results = await Promise.all(promises);
  const [crawlRes, crawlPagesRes, auditRes, serpRes, backlinkRes, gscRes, ga4Res, indexHistoryRes, adsRes, anomalyRes] = results;
  const baseIdx = 10; // first optional index
  const diagRes = options?.includeDiagnostics ? results[baseIdx] : { data: null };
  const recoRes = options?.includeRecos ? results[baseIdx + (options?.includeDiagnostics ? 1 : 0)] : { data: null };

  const blocks: string[] = [];

  if (crawlRes.data?.length) {
    const latest = crawlRes.data[0];
    blocks.push(`CRAWL MULTI-PAGES (dernier: ${latest.created_at?.slice(0, 10)}):
- Statut: ${latest.status}, Pages: ${latest.crawled_pages}/${latest.total_pages}, Score moyen: ${latest.avg_score || '—'}/200
- Résumé IA: ${latest.ai_summary?.slice(0, 500) || 'Non disponible'}`);
  }

  if (crawlPagesRes.data?.length) {
    const worstPages = crawlPagesRes.data.slice(0, 15).map((p: any) =>
      `  - ${p.url} | Score: ${p.seo_score}/200 | Mots: ${p.word_count || '?'} | Liens int: ${p.internal_links || 0} | Profondeur: ${p.crawl_depth || '?'} | Noindex: ${p.has_noindex ? 'oui' : 'non'} | Issues: ${(p.issues || []).join(', ') || 'aucune'}`
    ).join('\n');
    blocks.push(`PAGES LES PLUS FAIBLES (top 15 par score):\n${worstPages}`);
  }

  if (auditRes.data?.length) {
    blocks.push(`AUDITS RÉALISÉS:\n${auditRes.data.map((a: any) => `  - ${a.audit_type} le ${a.created_at?.slice(0, 10)}`).join('\n')}`);
  }

  if (serpRes.data?.length) {
    for (const entry of serpRes.data) {
      if (entry.data_type === 'serp_kpis' && entry.result_data) {
        const d = entry.result_data as any;
        blocks.push(`SERP KPIs (${entry.created_at?.slice(0, 10)}):
- Mots-clés organiques: ${d.organic_keywords || '?'}, Trafic estimé: ${d.organic_traffic || '?'}
- Domaine rank: ${d.domain_rank || '?'}, Autorité sémantique: ${d.semantic_authority || '?'}`);
      }
    }
  }

  if (backlinkRes.data?.length) {
    const bl = backlinkRes.data[0];
    blocks.push(`BACKLINKS (${bl.measured_at?.slice(0, 10)}):
- Domaines référents: ${bl.referring_domains || '?'}, Total backlinks: ${bl.backlinks_total || '?'}
- Rang domaine: ${bl.domain_rank || '?'}, Nouveaux: +${bl.referring_domains_new || 0}, Perdus: -${bl.referring_domains_lost || 0}`);
  }

  if (gscRes.data?.length) {
    const latest = gscRes.data[0];
    blocks.push(`GOOGLE SEARCH CONSOLE (semaine ${latest.week_start_date}):
- Clics: ${latest.clicks}, Impressions: ${latest.impressions}, CTR: ${((latest.ctr || 0) * 100).toFixed(1)}%, Position moy: ${latest.avg_position?.toFixed(1) || '?'}
- Top requêtes: ${JSON.stringify(latest.top_queries)?.slice(0, 300) || 'N/A'}`);
  }

  if (ga4Res.data?.length) {
    const latest = ga4Res.data[0];
    blocks.push(`GOOGLE ANALYTICS (semaine ${latest.week_start_date}):
- Utilisateurs: ${latest.total_users}, Sessions: ${latest.sessions}, Pages vues: ${latest.pageviews}
- Taux rebond: ${((latest.bounce_rate || 0) * 100).toFixed(1)}%, Engagement: ${((latest.engagement_rate || 0) * 100).toFixed(1)}%`);
  }

  if (indexHistoryRes.data?.length) {
    const latest = indexHistoryRes.data[0];
    blocks.push(`INDEXATION (semaine ${latest.week_start_date}):
- Total pages: ${latest.total_pages}, Indexées: ${latest.indexed_count}, Noindex: ${latest.noindex_count}
- GSC indexées: ${latest.gsc_indexed_count || 'N/A'}`);
  }

  if (adsRes?.data?.length) {
    const latest = adsRes.data[0];
    const costEur = ((Number(latest.cost_micros) || 0) / 1_000_000).toFixed(2);
    blocks.push(`GOOGLE ADS (semaine ${latest.week_start_date}):
- Impressions: ${latest.impressions}, Clics: ${latest.clicks}, CTR: ${((Number(latest.ctr) || 0) * 100).toFixed(1)}%
- Coût: ${costEur}€, Conversions: ${latest.conversions}, Taux conv.: ${((Number(latest.conversion_rate) || 0) * 100).toFixed(1)}%`);
  }

  if (anomalyRes?.data?.length) {
    const alertLines = anomalyRes.data.map((a: any) =>
      `  - [${a.severity?.toUpperCase()}] ${a.metric_name} (${a.metric_source}): ${a.description}`
    ).join('\n');
    blocks.push(`ANOMALIES DÉTECTÉES:\n${alertLines}`);
  }

  return {
    blocks,
    raw: {
      crawl: crawlRes.data?.[0] || null,
      crawlPages: crawlPagesRes.data || [],
      audits: auditRes.data || [],
      serp: serpRes.data || [],
      backlinks: backlinkRes.data?.[0] || null,
      gsc: gscRes.data || [],
      ga4: ga4Res.data || [],
      googleAds: adsRes?.data || [],
      indexHistory: indexHistoryRes.data || [],
      diagnostics: diagRes?.data || [],
      strategistRecos: recoRes?.data || [],
      anomalyAlerts: anomalyRes?.data || [],
    },
  };
}
