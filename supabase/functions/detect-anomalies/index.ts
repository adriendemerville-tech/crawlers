import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';

/**
 * detect-anomalies: Z-score anomaly detection across all data sources
 * 
 * Sources: GSC, GA4, GMB, Google Ads, IAS, SERP
 * Method: Z-score on 8-week rolling window
 * Thresholds: z > 2 → green (hausse), z < -1.5 → orange, z < -2 → red (baisse)
 * 
 * Modes:
 * - POST { tracked_site_id } → run detection for one site
 * - POST { all: true } → cron mode, run for all active sites
 */

interface MetricSeries {
  metric_name: string;
  metric_source: string;
  values: number[];
  current: number;
  affected_pages?: number;
  label_fn?: (val: number, pct: number) => string;
}

function computeZScore(values: number[], current: number): { z: number; mean: number; stddev: number } {
  if (values.length < 4) return { z: 0, mean: current, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return { z: 0, mean, stddev: 0 };
  return { z: (current - mean) / stddev, mean, stddev };
}

function classifyAnomaly(z: number): { severity: string; direction: string } | null {
  if (z >= 2) return { severity: 'success', direction: 'up' };
  if (z <= -2) return { severity: 'danger', direction: 'down' };
  if (z <= -1.5) return { severity: 'warning', direction: 'down' };
  if (z >= 1.5) return { severity: 'info', direction: 'up' };
  return null; // No anomaly
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const supabase = getServiceClient();

    // Determine which sites to analyze
    let siteIds: { id: string; domain: string }[] = [];

    if (body.all) {
      // Cron mode: all active sites
      const { data: sites } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('is_active', true)
        .limit(200);
      siteIds = sites || [];
    } else if (body.tracked_site_id) {
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('id', body.tracked_site_id)
        .maybeSingle();
      if (site) siteIds = [site];
    } else {
      // All sites for this user
      const { data: sites } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', auth.userId)
        .eq('is_active', true);
      siteIds = sites || [];
    }

    let totalAlerts = 0;

    for (const site of siteIds) {
      const alerts = await detectForSite(supabase, site.id, site.domain, auth.userId);
      totalAlerts += alerts;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sites_analyzed: siteIds.length, 
      alerts_created: totalAlerts 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[detect-anomalies] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function detectForSite(supabase: any, trackedSiteId: string, domain: string, userId: string): Promise<number> {
  // Fetch site identity card for seasonality awareness
  let isSeasonal = false;
  let seasonalityProfile: any = null;
  try {
    const ctx = await getSiteContext(supabase, { trackedSiteId });
    if (ctx) {
      isSeasonal = !!(ctx as any).is_seasonal;
      seasonalityProfile = (ctx as any).seasonality_profile;
      if (isSeasonal) console.log(`[detect-anomalies] ${domain}: seasonal site detected, adjusting thresholds`);
    }
  } catch (_) { /* non-blocking */ }

  // Fetch all historical data in parallel (8 weeks + current)
  const [gscRes, ga4Res, gmbRes, adsRes, serpRes] = await Promise.all([
    supabase
      .from('gsc_history_log')
      .select('clicks, impressions, ctr, avg_position, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(9),
    supabase
      .from('ga4_history_log')
      .select('total_users, sessions, pageviews, bounce_rate, engagement_rate, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(9),
    supabase
      .from('gmb_performance')
      .select('search_views, maps_views, website_clicks, phone_calls, week_start_date')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })
      .limit(9),
    supabase
      .from('google_ads_history_log')
      .select('impressions, clicks, ctr, conversions, conversion_rate, cost_micros, week_start_date')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(9),
    supabase
      .from('domain_data_cache')
      .select('result_data, created_at')
      .eq('domain', domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*/, '').toLowerCase())
      .eq('data_type', 'serp_kpis')
      .order('created_at', { ascending: false })
      .limit(9),
  ]);

  const series: MetricSeries[] = [];

  // --- GSC metrics ---
  const gsc = (gscRes.data || []).reverse(); // oldest first
  if (gsc.length >= 5) {
    const current = gsc[gsc.length - 1];
    const history = gsc.slice(0, -1);
    series.push(
      { metric_name: 'Clics organiques', metric_source: 'gsc', values: history.map((r: any) => r.clicks || 0), current: current.clicks || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de clics organiques` },
      { metric_name: 'Impressions SERP', metric_source: 'gsc', values: history.map((r: any) => r.impressions || 0), current: current.impressions || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% d'impressions` },
      { metric_name: 'CTR SERP', metric_source: 'gsc', values: history.map((r: any) => r.ctr || 0), current: current.ctr || 0, label_fn: (v, p) => `CTR ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(1)}%` },
      { metric_name: 'Position moyenne', metric_source: 'gsc', values: history.map((r: any) => r.avg_position || 0), current: current.avg_position || 0, label_fn: (v, p) => `Position moyenne ${p < 0 ? 'améliorée' : 'dégradée'} de ${Math.abs(p).toFixed(1)}%` },
    );
  }

  // --- GA4 metrics ---
  const ga4 = (ga4Res.data || []).reverse();
  if (ga4.length >= 5) {
    const current = ga4[ga4.length - 1];
    const history = ga4.slice(0, -1);
    series.push(
      { metric_name: 'Pages vues', metric_source: 'ga4', values: history.map((r: any) => r.pageviews || 0), current: current.pageviews || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de pages vues` },
      { metric_name: 'Sessions', metric_source: 'ga4', values: history.map((r: any) => r.sessions || 0), current: current.sessions || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de sessions` },
      { metric_name: 'Taux de rebond', metric_source: 'ga4', values: history.map((r: any) => r.bounce_rate || 0), current: current.bounce_rate || 0, label_fn: (v, p) => `Taux de rebond ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(1)}%` },
      { metric_name: 'Engagement', metric_source: 'ga4', values: history.map((r: any) => r.engagement_rate || 0), current: current.engagement_rate || 0, label_fn: (v, p) => `Engagement ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(1)}%` },
    );
  }

  // --- GMB metrics ---
  const gmb = (gmbRes.data || []).reverse();
  if (gmb.length >= 5) {
    const current = gmb[gmb.length - 1];
    const history = gmb.slice(0, -1);
    series.push(
      { metric_name: 'Vues Google Maps', metric_source: 'gmb', values: history.map((r: any) => r.maps_views || 0), current: current.maps_views || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de vues Maps` },
      { metric_name: 'Clics site web (GMB)', metric_source: 'gmb', values: history.map((r: any) => r.website_clicks || 0), current: current.website_clicks || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de clics GMB` },
    );
  }

  // --- Google Ads metrics ---
  const ads = (adsRes.data || []).reverse();
  if (ads.length >= 5) {
    const current = ads[ads.length - 1];
    const history = ads.slice(0, -1);
    series.push(
      { metric_name: 'Clics Ads', metric_source: 'google_ads', values: history.map((r: any) => r.clicks || 0), current: current.clicks || 0, label_fn: (v, p) => `${p > 0 ? '+' : ''}${p.toFixed(0)}% de clics Ads` },
      { metric_name: 'Conversions Ads', metric_source: 'google_ads', values: history.map((r: any) => Number(r.conversions) || 0), current: Number(current.conversions) || 0, label_fn: (v, p) => `Conversions ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(0)}%` },
      { metric_name: 'Coût publicitaire', metric_source: 'google_ads', values: history.map((r: any) => Number(r.cost_micros) || 0), current: Number(current.cost_micros) || 0, label_fn: (v, p) => `Coût Ads ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(0)}%` },
    );
  }

  // --- IAS from SERP KPIs ---
  const serp = (serpRes.data || []).reverse();
  if (serp.length >= 5) {
    const iasValues = serp.map((r: any) => Number(r.result_data?.semantic_authority) || 0).filter((v: number) => v > 0);
    if (iasValues.length >= 5) {
      const current = iasValues[iasValues.length - 1];
      const history = iasValues.slice(0, -1);
      series.push({
        metric_name: 'Autorité sémantique (IAS)', metric_source: 'serp', values: history, current,
        label_fn: (v, p) => `IAS ${p > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(p).toFixed(1)}%`,
      });
    }
  }

  // Run Z-score detection on all series
  const newAlerts: any[] = [];

  for (const s of series) {
    const { z, mean, stddev } = computeZScore(s.values, s.current);

    // Seasonal sites: relax thresholds to avoid false positives during expected dips
    const adjustedClassification = isSeasonal
      ? classifyAnomaly(z * 0.75) // Reduce z-score sensitivity by 25% for seasonal sites
      : classifyAnomaly(z);
    if (!adjustedClassification) continue;

    // For position, direction is inverted (lower is better)
    let { severity, direction } = adjustedClassification;
    if (s.metric_name === 'Position moyenne' || s.metric_name === 'Taux de rebond' || s.metric_name === 'Coût publicitaire') {
      // Inverted metrics: going down is good
      if (direction === 'up') {
        severity = 'danger';
        direction = 'down';
      } else {
        severity = 'success';
        direction = 'up';
      }
    }

    const changePct = mean > 0 ? ((s.current - mean) / mean) * 100 : 0;
    const description = s.label_fn ? s.label_fn(s.current, changePct) : `${s.metric_name}: ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`;

    newAlerts.push({
      tracked_site_id: trackedSiteId,
      user_id: userId,
      domain,
      metric_name: s.metric_name,
      metric_source: s.metric_source,
      severity,
      direction,
      z_score: Math.round(z * 100) / 100,
      current_value: s.current,
      baseline_mean: Math.round(mean * 100) / 100,
      baseline_stddev: Math.round(stddev * 100) / 100,
      change_pct: Math.round(changePct * 100) / 100,
      affected_pages: s.affected_pages || 0,
      description,
    });
  }

  if (newAlerts.length > 0) {
    // Clear old non-dismissed alerts for this site (keep dismissed as history)
    await supabase
      .from('anomaly_alerts')
      .delete()
      .eq('tracked_site_id', trackedSiteId)
      .eq('is_dismissed', false);

    const { error } = await supabase.from('anomaly_alerts').insert(newAlerts);
    if (error) console.error(`[detect-anomalies] Insert error for ${domain}:`, error);
  }

  return newAlerts.length;
}
