import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getDomainContext } from '../_shared/getDomainContext.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const startTime = Date.now();
  const supabase = getServiceClient();

  try {
    // Check if detector is enabled
    const { data: config } = await supabase
      .from('drop_detector_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (!config?.is_enabled) {
      return jsonOk({ skipped: true, reason: 'disabled' });
    }

    const minWeeks = config.min_data_weeks || 4;
    const dropThreshold = config.drop_threshold || 15;
    const predictionThreshold = config.prediction_threshold || 80;

    // Get all tracked sites with GSC data
    const { data: sites } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, google_connection_id')
      .not('google_connection_id', 'is', null);

    if (!sites?.length) {
      await logRun(supabase, 'scheduled', 0, 0, 0, null, Date.now() - startTime);
      return jsonOk({ sites: 0, alerts: 0 });
    }

    let alertsGenerated = 0;
    let diagnosticsCreated = 0;
    const errors: any[] = [];

    for (const site of sites) {
      try {
        // Fetch identity card for seasonality awareness
        const siteContext = await getSiteContext(supabase, { trackedSiteId: site.id, userId: site.user_id })
        const isSeasonal = !!(siteContext as any)?.is_seasonal
        // Relax drop threshold by 25% for seasonal sites
        const adjustedDropThreshold = isSeasonal ? dropThreshold * 1.25 : dropThreshold
        const adjustedPredictionThreshold = isSeasonal ? Math.min(95, predictionThreshold * 1.15) : predictionThreshold

        const result = await analyzeSite(supabase, site, minWeeks, adjustedDropThreshold, adjustedPredictionThreshold);
        if (result.alert) alertsGenerated++;
        if (result.diagnostic) diagnosticsCreated++;
      } catch (err) {
        errors.push({ site_id: site.id, domain: site.domain, error: String(err) });
      }
    }

    // Update config with last run stats
    await supabase
      .from('drop_detector_config')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_sites_count: sites.length,
        last_run_alerts_count: alertsGenerated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    await logRun(supabase, 'scheduled', sites.length, alertsGenerated, diagnosticsCreated, errors.length > 0 ? errors : null, Date.now() - startTime);

    return jsonOk({
      sites: sites.length,
      alerts: alertsGenerated,
      diagnostics: diagnosticsCreated,
      errors: errors.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error('drop-detector fatal error:', e);
    await logRun(supabase, 'scheduled', 0, 0, 0, [{ error: String(e) }], Date.now() - startTime);
    return jsonError(String(e), 500);
  }
}));

async function logRun(
  supabase: any, runType: string, sites: number, alerts: number, diagnostics: number,
  errors: any, durationMs: number
) {
  await supabase.from('drop_detector_logs').insert({
    run_type: runType,
    sites_scanned: sites,
    alerts_generated: alerts,
    diagnostics_created: diagnostics,
    errors,
    duration_ms: durationMs,
  });
}

interface AnalysisResult {
  alert: boolean;
  diagnostic: boolean;
}

async function analyzeSite(
  supabase: any,
  site: { id: string; domain: string; user_id: string },
  minWeeks: number,
  dropThreshold: number,
  predictionThreshold: number,
): Promise<AnalysisResult> {
  // Fetch GSC weekly data (need at least minWeeks)
  const { data: gscWeeks } = await supabase
    .from('gsc_history_log')
    .select('clicks, impressions, ctr, avg_position, week_start_date')
    .eq('tracked_site_id', site.id)
    .order('week_start_date', { ascending: false })
    .limit(12);

  if (!gscWeeks || gscWeeks.length < minWeeks) {
    return { alert: false, diagnostic: false };
  }

  // Calculate week-over-week trends
  const trends = calculateTrends(gscWeeks);

  // Is there an active drop?
  const reactiveDrop = trends.clicksChangeWoW <= -dropThreshold || trends.clicksChange4w <= -dropThreshold;

  // Predictive: linear regression on clicks to project 2-4 weeks ahead
  const prediction = predictDrop(gscWeeks, predictionThreshold);

  if (!reactiveDrop && !prediction.willDrop) {
    return { alert: false, diagnostic: false };
  }

  // Check for existing recent diagnostic to avoid duplicates
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('drop_diagnostics')
    .select('id')
    .eq('tracked_site_id', site.id)
    .gte('created_at', oneWeekAgo)
    .limit(1);

  if (existing?.length) {
    return { alert: false, diagnostic: false };
  }

  // Fetch full domain context for cross-analysis
  const ctx = await getDomainContext(supabase, site.domain, site.id, {
    includeDiagnostics: true,
    includeRecos: true,
    userId: site.user_id,
  });

  // Cross-analyze to determine verdict
  const verdict = crossAnalyze(trends, ctx, prediction);

  // Determine period
  const periodEnd = gscWeeks[0].week_start_date;
  const periodStart = gscWeeks[Math.min(gscWeeks.length - 1, 7)].week_start_date;

  const dropScore = Math.min(100, Math.round(Math.abs(trends.clicksChange4w) * 2));

  // Insert diagnostic
  await supabase.from('drop_diagnostics').insert({
    tracked_site_id: site.id,
    user_id: site.user_id,
    domain: site.domain,
    diagnosis_type: reactiveDrop ? 'reactive' : 'predictive',
    drop_score: dropScore,
    drop_probability: prediction.probability,
    period_start: periodStart,
    period_end: periodEnd,
    verdict: verdict.primary,
    verdict_details: verdict,
    gsc_data: {
      weeks: gscWeeks.slice(0, 8),
      trends,
    },
    ga4_data: ctx.raw.ga4?.length ? { weeks: ctx.raw.ga4 } : null,
    crawl_data: ctx.raw.crawl ? { summary: ctx.raw.crawl } : null,
    backlink_data: ctx.raw.backlinks || null,
    eeat_geo_data: extractEeatGeo(ctx),
    technical_data: extractTechnical(ctx),
    affected_pages: ctx.raw.crawlPages?.slice(0, 20).map((p: any) => ({
      url: p.url,
      score: p.seo_score,
      issues: p.issues,
    })) || null,
    recommendations: verdict.recommendations || null,
  });

  // Create anomaly alert for the console banner
  const alertDescription = reactiveDrop
    ? `⚠️ Baisse de ${Math.abs(Math.round(trends.clicksChange4w))}% des clics détectée — Cause probable : ${verdict.primaryLabel}`
    : `🔮 Prédiction : baisse de trafic probable (${prediction.probability}% de certitude) dans les 2-4 semaines — ${verdict.primaryLabel}`;

  await supabase.from('anomaly_alerts').insert({
    tracked_site_id: site.id,
    user_id: site.user_id,
    domain: site.domain,
    metric_name: reactiveDrop ? 'traffic_drop' : 'traffic_drop_predicted',
    metric_source: 'drop_detector',
    severity: dropScore >= 60 ? 'critical' : dropScore >= 30 ? 'warning' : 'info',
    direction: 'down',
    current_value: gscWeeks[0]?.clicks || 0,
    baseline_mean: trends.baseline4wAvg,
    baseline_stddev: trends.stddev,
    z_score: trends.zScore,
    change_pct: trends.clicksChange4w,
    description: alertDescription,
    affected_pages: ctx.raw.crawlPages?.filter((p: any) => (p.seo_score || 0) < 80).length || null,
  });

  return { alert: true, diagnostic: true };
}

interface Trends {
  clicksChangeWoW: number;
  clicksChange4w: number;
  impressionsChange4w: number;
  ctrChange4w: number;
  positionChange4w: number;
  baseline4wAvg: number;
  stddev: number;
  zScore: number;
  trend: 'declining' | 'stable' | 'growing';
}

function calculateTrends(weeks: any[]): Trends {
  const clicks = weeks.map((w: any) => w.clicks || 0);
  const current = clicks[0];
  const prev = clicks[1] || current;
  const avg4w = clicks.slice(1, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(4, clicks.length - 1) || 1;

  // Standard deviation
  const mean = clicks.reduce((a: number, b: number) => a + b, 0) / clicks.length;
  const variance = clicks.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / clicks.length;
  const stddev = Math.sqrt(variance) || 1;
  const zScore = (current - mean) / stddev;

  const clicksChangeWoW = ((current - prev) / (prev || 1)) * 100;
  const clicksChange4w = ((current - avg4w) / (avg4w || 1)) * 100;

  const impressions = weeks.map((w: any) => w.impressions || 0);
  const impressionsCurrent = impressions[0];
  const impressionsAvg4w = impressions.slice(1, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(4, impressions.length - 1) || 1;
  const impressionsChange4w = ((impressionsCurrent - impressionsAvg4w) / (impressionsAvg4w || 1)) * 100;

  const ctr = weeks.map((w: any) => w.ctr || 0);
  const ctrChange4w = ((ctr[0] - (ctr.slice(1, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(4, ctr.length - 1) || 1)) / (ctr.slice(1, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(4, ctr.length - 1) || 1)) * 100;

  const pos = weeks.map((w: any) => w.avg_position || 0);
  const posChange4w = pos[0] - (pos.slice(1, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(4, pos.length - 1) || 1);

  // Determine overall trend via linear regression slope on clicks
  const n = Math.min(8, clicks.length);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = n - 1 - i; // older = higher x
    const y = clicks[i];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const trend = slope > 0.05 * mean ? 'growing' : slope < -0.05 * mean ? 'declining' : 'stable';

  return {
    clicksChangeWoW,
    clicksChange4w,
    impressionsChange4w,
    ctrChange4w,
    positionChange4w: posChange4w,
    baseline4wAvg: avg4w,
    stddev,
    zScore,
    trend,
  };
}

function predictDrop(weeks: any[], threshold: number): { willDrop: boolean; probability: number; projectedClicks: number } {
  const clicks = weeks.map((w: any) => w.clicks || 0);
  const n = Math.min(8, clicks.length);
  if (n < 4) return { willDrop: false, probability: 0, projectedClicks: clicks[0] };

  // Linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = n - 1 - i;
    const y = clicks[i];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;

  // Project 3 weeks ahead
  const projected = intercept + slope * (n + 2);
  const currentAvg = clicks.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
  const projectedChange = ((projected - currentAvg) / (currentAvg || 1)) * 100;

  // Calculate confidence based on R² and consistency of decline
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const x = n - 1 - i;
    const yPred = intercept + slope * x;
    ssTot += Math.pow(clicks[i] - yMean, 2);
    ssRes += Math.pow(clicks[i] - yPred, 2);
  }
  const r2 = 1 - ssRes / (ssTot || 1);

  // Consecutive declining weeks boost confidence
  let consecutiveDeclines = 0;
  for (let i = 0; i < clicks.length - 1; i++) {
    if (clicks[i] < clicks[i + 1]) consecutiveDeclines++;
    else break;
  }

  // Probability: R² * decline magnitude * consecutive weeks factor
  let probability = 0;
  if (projectedChange < -10) {
    probability = Math.min(99, Math.round(
      Math.abs(projectedChange) * r2 * (1 + consecutiveDeclines * 0.15) * 1.5
    ));
  }

  return {
    willDrop: probability >= threshold,
    probability,
    projectedClicks: Math.round(projected),
  };
}

interface Verdict {
  primary: string;
  primaryLabel: string;
  axes: {
    trust: number;
    technical: number;
    content: number;
    links: number;
    geo: number;
  };
  details: string[];
  recommendations: string[];
}

function crossAnalyze(trends: Trends, ctx: any, prediction: any): Verdict {
  const axes = { trust: 0, technical: 0, content: 0, links: 0, geo: 0 };
  const details: string[] = [];
  const recommendations: string[] = [];

  // --- Technical analysis ---
  const techPayload = ctx.raw.auditTechnique?.raw_payload;
  if (techPayload) {
    const techScore = techPayload.technicalScore || techPayload.seoScore || 0;
    if (techScore < 50) {
      axes.technical += 30;
      details.push(`Score technique faible (${techScore}/100)`);
      recommendations.push('Audit technique prioritaire : corriger les erreurs critiques');
    }
    const perfScore = techPayload.performanceScore || 0;
    if (perfScore < 40) {
      axes.technical += 20;
      details.push(`Performance dégradée (${perfScore}/100)`);
      recommendations.push('Optimiser Core Web Vitals');
    }
  }

  // --- Content analysis ---
  const weakPages = ctx.raw.crawlPages?.filter((p: any) => (p.seo_score || 0) < 60) || [];
  if (weakPages.length > ctx.raw.crawlPages?.length * 0.3) {
    axes.content += 25;
    details.push(`${weakPages.length} pages avec score < 60/200 (${Math.round(weakPages.length / (ctx.raw.crawlPages?.length || 1) * 100)}%)`);
    recommendations.push('Réécrire ou consolider les pages à faible score');
  }

  const thinPages = ctx.raw.crawlPages?.filter((p: any) => (p.word_count || 0) < 300) || [];
  if (thinPages.length > 5) {
    axes.content += 15;
    details.push(`${thinPages.length} pages thin content (<300 mots)`);
    recommendations.push('Étoffer ou supprimer les pages thin content');
  }

  // --- Links analysis ---
  const bl = ctx.raw.backlinks;
  if (bl) {
    if ((bl.referring_domains_lost || 0) > (bl.referring_domains_new || 0) * 2) {
      axes.links += 30;
      details.push(`Perte massive de backlinks : -${bl.referring_domains_lost} domaines référents`);
      recommendations.push('Analyser les liens perdus et lancer une campagne de link building');
    }
    if ((bl.domain_rank || 0) < 10) {
      axes.links += 10;
      details.push(`Autorité de domaine faible (rank: ${bl.domain_rank})`);
    }
  }

  // --- Trust / E-E-A-T analysis ---
  const stratPayload = ctx.raw.auditStrategique?.raw_payload;
  if (stratPayload) {
    const geoScore = stratPayload.geoScore || 0;
    const aeoScore = stratPayload.aeoScore || 0;
    if (geoScore < 30) {
      axes.geo += 25;
      details.push(`GEO Score très faible (${geoScore}/100) : faible visibilité dans les moteurs IA`);
      recommendations.push('Optimiser la citabilité LLM et le positionnement GEO');
    }
    if (aeoScore < 30) {
      axes.trust += 15;
      details.push(`Score AEO faible (${aeoScore}/100)`);
    }
    if (stratPayload.missingTerms?.length > 5) {
      axes.content += 15;
      details.push(`${stratPayload.missingTerms.length} lacunes sémantiques identifiées`);
      recommendations.push('Combler les lacunes sémantiques identifiées');
    }
  }

  // If impressions drop but position stable → trust/authority issue
  if (trends.impressionsChange4w < -15 && Math.abs(trends.positionChange4w) < 3) {
    axes.trust += 25;
    details.push('Impressions en chute mais positions stables → problème de confiance/autorité perçue');
    recommendations.push('Renforcer les signaux E-E-A-T : auteur, expertise, citations');
  }

  // If position degrades significantly → content/competition issue
  if (trends.positionChange4w > 5) {
    axes.content += 20;
    details.push(`Position moyenne dégradée de +${trends.positionChange4w.toFixed(1)} positions`);
    recommendations.push('Analyser les SERP pour identifier les nouveaux concurrents');
  }

  // Anomaly alerts boost
  if (ctx.raw.anomalyAlerts?.length) {
    for (const alert of ctx.raw.anomalyAlerts) {
      if (alert.metric_source === 'gsc' || alert.metric_name?.includes('traffic')) {
        axes.trust += 5;
      }
    }
  }

  // Determine primary verdict
  const maxAxis = Object.entries(axes).sort((a, b) => b[1] - a[1])[0];
  const primary = maxAxis[1] > 0 ? maxAxis[0] : 'unknown';
  const labels: Record<string, string> = {
    trust: 'Trust / Crédibilité',
    technical: 'Problèmes techniques',
    content: 'Qualité du contenu',
    links: 'Profil de liens',
    geo: 'Visibilité GEO/IA',
    unknown: 'Cause non déterminée',
  };

  if (details.length === 0) {
    details.push('Chute sitewide détectée — analyse croisée en cours de collecte de données');
    recommendations.push('Connecter GSC + GA4 pour un diagnostic plus précis');
  }

  return {
    primary,
    primaryLabel: labels[primary] || primary,
    axes,
    details,
    recommendations,
  };
}

function extractEeatGeo(ctx: any): any {
  const strat = ctx.raw.auditStrategique?.raw_payload;
  if (!strat) return null;
  return {
    geoScore: strat.geoScore,
    aeoScore: strat.aeoScore,
    globalScore: strat.globalScore,
    missingTerms: strat.missingTerms?.slice(0, 10),
    clientTargets: strat.clientTargets || strat.client_targets,
  };
}

function extractTechnical(ctx: any): any {
  const tech = ctx.raw.auditTechnique?.raw_payload;
  if (!tech) return null;
  return {
    technicalScore: tech.technicalScore,
    performanceScore: tech.performanceScore,
    seoScore: tech.seoScore,
    issuesCount: (tech.recommendations || tech.fixes || tech.issues || []).length,
    schemaOrg: tech.schemaOrg || tech.structuredData,
  };
}