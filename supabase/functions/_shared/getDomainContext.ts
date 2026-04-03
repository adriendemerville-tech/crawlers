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
  options?: { includeDiagnostics?: boolean; includeRecos?: boolean; maxPages?: number; userId?: string }
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
          .select('url, title, seo_score, word_count, internal_links, external_links, h1, has_noindex, is_indexable, crawl_depth, page_type_override, issues, body_text_truncated')
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
    // 12: bot log analysis (last 7 days aggregated)
    supabase
      .rpc('get_bot_log_summary', { p_tracked_site_id: trackedSiteId })
      .then((res: any) => res)
      .catch(() => ({ data: null })),
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
  const [crawlRes, crawlPagesRes, auditRes, serpRes, backlinkRes, gscRes, ga4Res, indexHistoryRes, adsRes, anomalyRes, auditTechRes, auditStratRes, botLogRes] = results;
  const baseIdx = 13; // first optional index (was 12, now 13 with botLogRes)
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

  // ── Audit Technique findings ──
  const auditTechData = auditTechRes?.data?.[0] || null;
  if (auditTechData?.raw_payload) {
    const payload = auditTechData.raw_payload as any;
    const techLines: string[] = [];
    
    // Extract key technical findings
    if (payload.technicalScore !== undefined) techLines.push(`Score technique: ${payload.technicalScore}/100`);
    if (payload.performanceScore !== undefined) techLines.push(`Score performance: ${payload.performanceScore}/100`);
    if (payload.seoScore !== undefined) techLines.push(`Score SEO: ${payload.seoScore}/100`);
    
    // Recommendations from expert audit
    const recos = payload.recommendations || payload.fixes || payload.issues || [];
    if (Array.isArray(recos) && recos.length > 0) {
      const topRecos = recos.slice(0, 10).map((r: any) => {
        const title = r.title || r.name || r.issue || r.description || JSON.stringify(r).slice(0, 100);
        const priority = r.priority || r.severity || r.impact || '';
        return `  - [${priority}] ${title}`;
      }).join('\n');
      techLines.push(`Recommandations:\n${topRecos}`);
    }
    
    // Image issues
    if (payload.imageAnalysis) {
      const img = payload.imageAnalysis;
      techLines.push(`Images: ${img.total || '?'} total, ${img.withoutAlt || '?'} sans alt, ${img.oversized || '?'} surdimensionnées`);
    }
    
    // Schema.org findings
    if (payload.schemaOrg || payload.structuredData) {
      const schema = payload.schemaOrg || payload.structuredData;
      techLines.push(`Schema.org: ${schema.types?.join(', ') || 'aucun'}, Erreurs: ${schema.errors?.length || 0}`);
    }
    
    if (techLines.length > 0) {
      blocks.push(`AUDIT TECHNIQUE (${auditTechData.created_at?.slice(0, 10)}):\n${techLines.join('\n')}`);
    }
  }

  // ── Audit Stratégique findings ──
  const auditStratData = auditStratRes?.data?.[0] || null;
  if (auditStratData?.raw_payload) {
    const payload = auditStratData.raw_payload as any;
    const stratLines: string[] = [];
    
    // Global scores
    if (payload.globalScore !== undefined) stratLines.push(`Score global: ${payload.globalScore}/100`);
    if (payload.aeoScore !== undefined) stratLines.push(`Score AEO (Answer Engine): ${payload.aeoScore}/100`);
    if (payload.geoScore !== undefined) stratLines.push(`Score GEO: ${payload.geoScore}/100`);
    
    // Keywords and semantic gaps
    const keywords = payload.keywords || payload.mainKeywords || [];
    if (Array.isArray(keywords) && keywords.length > 0) {
      const topKw = keywords.slice(0, 8).map((k: any) => {
        if (typeof k === 'string') return k;
        return `${k.keyword || k.term || k.query} (vol: ${k.volume || '?'}, pos: ${k.position || '?'})`;
      }).join(', ');
      stratLines.push(`Mots-clés principaux: ${topKw}`);
    }
    
    // Missing terms / semantic gaps
    const missingTerms = payload.missingTerms || payload.semanticGaps || payload.missing_terms || [];
    if (Array.isArray(missingTerms) && missingTerms.length > 0) {
      stratLines.push(`Lacunes sémantiques: ${missingTerms.slice(0, 10).join(', ')}`);
    }
    
    // Competitors
    const competitors = payload.competitors || payload.topCompetitors || [];
    if (Array.isArray(competitors) && competitors.length > 0) {
      const compList = competitors.slice(0, 5).map((c: any) => typeof c === 'string' ? c : (c.domain || c.url || '')).join(', ');
      stratLines.push(`Concurrents identifiés: ${compList}`);
    }
    
    // Strategic recommendations
    const stratRecos = payload.recommendations || payload.strategicActions || [];
    if (Array.isArray(stratRecos) && stratRecos.length > 0) {
      const topStratRecos = stratRecos.slice(0, 8).map((r: any) => {
        const title = r.title || r.action || r.description || JSON.stringify(r).slice(0, 100);
        const priority = r.priority || r.impact || '';
        return `  - [${priority}] ${title}`;
      }).join('\n');
      stratLines.push(`Recommandations stratégiques:\n${topStratRecos}`);
    }
    
    // Client targets
    if (payload.clientTargets || payload.client_targets) {
      const targets = payload.clientTargets || payload.client_targets;
      stratLines.push(`Cibles identifiées: ${JSON.stringify(targets).slice(0, 300)}`);
    }
    
    if (stratLines.length > 0) {
      blocks.push(`AUDIT STRATÉGIQUE (${auditStratData.created_at?.slice(0, 10)}):\n${stratLines.join('\n')}`);
    }
  }

  // ── Bot Log Analysis (from log_entries) ──
  const botLogData = botLogRes?.data;
  if (botLogData && typeof botLogData === 'object' && !Array.isArray(botLogData) && (botLogData as any).total_entries > 0) {
    const bl = botLogData as any;
    const logLines: string[] = [];
    logLines.push(`Entrées analysées: ${bl.total_entries} (derniers 7 jours)`);
    logLines.push(`Bots détectés: ${bl.total_bot_hits} hits (${bl.unique_bots} bots uniques)`);
    if (bl.top_bots?.length) {
      logLines.push(`Top bots: ${bl.top_bots.map((b: any) => `${b.bot_name} (${b.hits} hits)`).join(', ')}`);
    }
    if (bl.ai_bots?.length) {
      logLines.push(`🤖 Bots IA détectés: ${bl.ai_bots.map((b: any) => `${b.bot_name} (${b.hits} hits)`).join(', ')}`);
    } else {
      logLines.push(`⚠ Aucun bot IA détecté dans les logs (GPTBot, ClaudeBot, PerplexityBot absents)`);
    }
    if (bl.error_rate) {
      logLines.push(`Taux d'erreurs bots: ${bl.error_rate}% (4xx/5xx)`);
    }
    if (bl.top_paths?.length) {
      logLines.push(`Pages les plus crawlées: ${bl.top_paths.map((p: any) => `${p.path} (${p.hits})`).join(', ')}`);
    }
    blocks.push(`ANALYSE DES LOGS SERVEUR:\n${logLines.join('\n')}`);
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
      auditTechnique: auditTechData,
      auditStrategique: auditStratData,
      botLogs: botLogData || null,
    },
  };
}
