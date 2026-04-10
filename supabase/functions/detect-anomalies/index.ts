import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * detect-anomalies: Z-score anomaly detection across all data sources
 * 
 * Sources: GSC, GA4, GMB, Google Ads, IAS, SERP, GSC Daily Positions
 * Method: Z-score on 8-week rolling window + daily J-1 ranking anomaly
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

/**
 * Compute Z-score with adaptive thresholds based on Coefficient of Variation (CV).
 * High-CV series (volatile) get relaxed thresholds; low-CV series (stable) get tighter ones.
 * Also detects sustained trends via consecutive-decline counting.
 */
function computeZScore(values: number[], current: number): { z: number; mean: number; stddev: number; cv: number; trendStrength: number } {
  if (values.length < 4) return { z: 0, mean: current, stddev: 0, cv: 0, trendStrength: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 0;
  if (stddev === 0) return { z: 0, mean, stddev: 0, cv: 0, trendStrength: 0 };
  
  // Trend detection: count consecutive direction changes
  let consecutiveDeclines = 0;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] < values[i + 1]) consecutiveDeclines++;
    else break;
  }
  // trendStrength: 0-1 scale, >0.5 means sustained decline
  const trendStrength = Math.min(1, consecutiveDeclines / Math.max(3, values.length * 0.5));
  
  return { z: (current - mean) / stddev, mean, stddev, cv, trendStrength };
}

/**
 * Adaptive anomaly classification:
 * - Low CV (<0.15): tight thresholds (z ±1.5/±1.8) — stable metrics should alert early
 * - Medium CV (0.15-0.40): standard thresholds (z ±1.5/±2.0)
 * - High CV (>0.40): relaxed thresholds (z ±2.0/±2.5) — volatile metrics need bigger deviations
 * - Sustained trend bonus: lower threshold by 0.3 if 3+ consecutive declines
 */
function classifyAnomaly(z: number, cv = 0, trendStrength = 0): { severity: string; direction: string } | null {
  // Adaptive thresholds based on CV
  let dangerThreshold: number, warningThreshold: number, successThreshold: number, infoThreshold: number;
  
  if (cv < 0.15) {
    // Stable series: tighter thresholds
    dangerThreshold = -1.8; warningThreshold = -1.3; successThreshold = 1.8; infoThreshold = 1.3;
  } else if (cv > 0.40) {
    // Volatile series: relaxed thresholds
    dangerThreshold = -2.5; warningThreshold = -2.0; successThreshold = 2.5; infoThreshold = 2.0;
  } else {
    // Standard thresholds
    dangerThreshold = -2.0; warningThreshold = -1.5; successThreshold = 2.0; infoThreshold = 1.5;
  }
  
  // Sustained trend bonus: if 3+ consecutive declines, lower threshold by 0.3
  if (trendStrength > 0.5) {
    dangerThreshold += 0.3; // less negative = easier to trigger
    warningThreshold += 0.3;
  }

  if (z >= successThreshold) return { severity: 'success', direction: 'up' };
  if (z <= dangerThreshold) return { severity: 'danger', direction: 'down' };
  if (z <= warningThreshold) return { severity: 'warning', direction: 'down' };
  if (z >= infoThreshold) return { severity: 'info', direction: 'up' };
  return null;
}

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', 401);
    }

    const body = await req.json();
    const supabase = getServiceClient();

    let siteIds: { id: string; domain: string; user_id: string }[] = [];

    if (body.all) {
      const { data: sites } = await supabase
        .from('tracked_sites')
        .select('id, domain, user_id')
        .eq('is_active', true)
        .limit(200);
      siteIds = (sites || []).map((s: any) => ({ id: s.id, domain: s.domain, user_id: s.user_id }));
    } else if (body.tracked_site_id) {
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id, domain, user_id')
        .eq('id', body.tracked_site_id)
        .maybeSingle();
      if (site) siteIds = [{ id: site.id, domain: site.domain, user_id: site.user_id }];
    } else {
      const { data: sites } = await supabase
        .from('tracked_sites')
        .select('id, domain, user_id')
        .eq('user_id', auth.userId)
        .eq('is_active', true);
      siteIds = (sites || []).map((s: any) => ({ id: s.id, domain: s.domain, user_id: s.user_id }));
    }

    let totalAlerts = 0;

    for (const site of siteIds) {
      const alerts = await detectForSite(supabase, site.id, site.domain, site.user_id);
      totalAlerts += alerts;
    }

    return jsonOk({ 
      success: true, 
      sites_analyzed: siteIds.length, 
      alerts_created: totalAlerts 
    });

  } catch (error) {
    console.error('[detect-anomalies] Error:', error);
    return jsonError('Internal error', 500);
  }
}));

// ── Send email alert for critical anomalies ──
async function sendDeclineAlert(supabase: any, userId: string, domain: string, alerts: any[]) {
  // Only send for danger-level alerts (decline)
  const dangerAlerts = alerts.filter(a => a.severity === 'danger' && a.direction === 'down');
  if (dangerAlerts.length === 0) return;

  // Get user email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, notification_preferences')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.email) return;

  // Check notification preferences
  const prefs = profile.notification_preferences as any || {};
  if (prefs.anomaly_alerts === false) return;

  // Don't send more than one alert email per domain per day
  const today = new Date().toISOString().split('T')[0];
  const { data: recentLog } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('recipient_email', profile.email)
    .eq('template_name', 'decline-alert')
    .gte('created_at', `${today}T00:00:00Z`)
    .maybeSingle();

  if (recentLog) return;

  const alertLines = dangerAlerts.slice(0, 5).map((a: any) => 
    `• <strong>${a.metric_name}</strong> (${a.metric_source}) : ${a.description}`
  ).join('<br/>');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a0533, #2d1b69); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">⚠️ Alerte de déclin détectée</h1>
        <p style="color: #c4b5fd; margin: 8px 0 0; font-size: 14px;">${domain}</p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          ${profile.first_name ? `Bonjour ${profile.first_name},` : 'Bonjour,'}<br/><br/>
          Crawlers a détecté <strong>${dangerAlerts.length} anomalie${dangerAlerts.length > 1 ? 's' : ''} critique${dangerAlerts.length > 1 ? 's' : ''}</strong> sur <strong>${domain}</strong> :
        </p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-size: 13px; color: #991b1b; line-height: 1.8;">
          ${alertLines}
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          Ces alertes sont basées sur une analyse Z-score de vos données des 8 dernières semaines. 
          Connectez-vous à votre console pour voir le détail et les recommandations.
        </p>
        <a href="https://crawlers.fr/app/console" style="display: inline-block; background: #7c3aed; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px;">Voir la console</a>
      </div>
    </div>
  `;

  try {
    await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: profile.email,
        from: 'alertes@notify.crawlers.fr',
        sender_domain: 'notify.crawlers.fr',
        subject: `⚠️ Alerte déclin — ${domain} : ${dangerAlerts.length} anomalie${dangerAlerts.length > 1 ? 's' : ''} détectée${dangerAlerts.length > 1 ? 's' : ''}`,
        html,
        text: `Alerte de déclin détectée sur ${domain}. ${dangerAlerts.length} anomalie(s) critique(s). Connectez-vous à https://crawlers.fr/app/console`,
        purpose: 'transactional',
        label: 'decline-alert',
        idempotency_key: `decline-alert-${domain}-${today}`,
        queued_at: new Date().toISOString(),
      },
    });

    // Mark alerts as email-sent
    for (const a of dangerAlerts) {
      if (a.id) {
        await supabase.from('anomaly_alerts').update({ email_alert_sent: true }).eq('id', a.id);
      }
    }

    console.log(`[detect-anomalies] 📧 Decline alert email sent to ${profile.email} for ${domain}`);
  } catch (e) {
    console.error(`[detect-anomalies] Email send error:`, e);
  }
}

async function detectForSite(supabase: any, trackedSiteId: string, domain: string, userId: string): Promise<number> {
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

  // Fetch all historical data in parallel (8 weeks + current) + daily positions
  const [gscRes, ga4Res, gmbRes, adsRes, serpRes, idxRes, dailyRes] = await Promise.all([
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
    supabase
      .from('indexation_checks')
      .select('verdict')
      .eq('tracked_site_id', trackedSiteId),
    // Daily positions for ranking anomaly (last 14 days)
    supabase
      .from('gsc_daily_positions')
      .select('query, position, clicks, date_val')
      .eq('tracked_site_id', trackedSiteId)
      .gte('date_val', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('date_val', { ascending: true }),
  ]);

  const series: MetricSeries[] = [];

  // --- GSC metrics ---
  const gsc = (gscRes.data || []).reverse();
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

  // --- Indexation ratio (threshold-based, no Z-score needed) ---
  const idxChecks = idxRes.data || [];
  if (idxChecks.length >= 5) {
    const totalChecked = idxChecks.length;
    const indexedCount = idxChecks.filter((r: any) => r.verdict === 'PASS').length;
    const indexedRatio = Math.round((indexedCount / totalChecked) * 100);
    if (indexedRatio < 50) {
      newAlerts.push({
        tracked_site_id: trackedSiteId,
        user_id: userId,
        domain,
        metric_name: 'Taux d\'indexation',
        metric_source: 'gsc_inspection',
        severity: indexedRatio < 30 ? 'danger' : 'warning',
        direction: 'down',
        z_score: -2,
        current_value: indexedRatio,
        baseline_mean: 80,
        baseline_stddev: 10,
        change_pct: indexedRatio - 80,
        affected_pages: totalChecked - indexedCount,
        description: `⚠️ Seulement ${indexedRatio}% des pages vérifiées sont indexées (${indexedCount}/${totalChecked})`,
      });
    }
  }

  // --- Daily ranking anomaly detection (J-1 granularity) ---
  const dailyData = dailyRes.data || [];
  if (dailyData.length > 0) {
    // Group by query
    const queryMap = new Map<string, { positions: number[]; clicks: number[]; dates: string[] }>();
    for (const row of dailyData) {
      const q = row.query;
      if (!queryMap.has(q)) queryMap.set(q, { positions: [], clicks: [], dates: [] });
      const entry = queryMap.get(q)!;
      entry.positions.push(Number(row.position));
      entry.clicks.push(row.clicks || 0);
      entry.dates.push(row.date_val);
    }

    let rankingDropCount = 0;
    const droppedQueries: string[] = [];

    for (const [query, data] of queryMap.entries()) {
      if (data.positions.length < 5) continue; // Need at least 5 days of data

      const current = data.positions[data.positions.length - 1];
      const history = data.positions.slice(0, -1);
      const { z, mean } = computeZScore(history, current);

      // For positions, higher z = worse (position increased = rank dropped)
      // Detect significant drops: position went from <10 to >15 (left first page)
      if (z >= 2 && mean <= 10 && current > 15) {
        rankingDropCount++;
        if (droppedQueries.length < 5) {
          droppedQueries.push(`"${query}" (${Math.round(mean)} → ${Math.round(current)})`);
        }
      }
    }

    if (rankingDropCount > 0) {
      newAlerts.push({
        tracked_site_id: trackedSiteId,
        user_id: userId,
        domain,
        metric_name: 'Chute de ranking quotidienne',
        metric_source: 'gsc_daily',
        severity: rankingDropCount >= 5 ? 'danger' : 'warning',
        direction: 'down',
        z_score: -2.5,
        current_value: rankingDropCount,
        baseline_mean: 0,
        baseline_stddev: 1,
        change_pct: 0,
        affected_pages: rankingDropCount,
        description: `📉 ${rankingDropCount} mot${rankingDropCount > 1 ? 's' : ''}-clé${rankingDropCount > 1 ? 's' : ''} ont quitté la 1ère page : ${droppedQueries.join(', ')}`,
      });
    }
  }

  for (const s of series) {
    const { z, mean, stddev, cv, trendStrength } = computeZScore(s.values, s.current);

    const adjustedZ = isSeasonal ? z * 0.75 : z;
    const adjustedClassification = classifyAnomaly(adjustedZ, cv, trendStrength);
    if (!adjustedClassification) continue;

    let { severity, direction } = adjustedClassification;
    if (s.metric_name === 'Position moyenne' || s.metric_name === 'Taux de rebond' || s.metric_name === 'Coût publicitaire') {
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

    const { error, data: insertedAlerts } = await supabase.from('anomaly_alerts').insert(newAlerts).select('id, severity, direction');
    if (error) console.error(`[detect-anomalies] Insert error for ${domain}:`, error);

    // Send decline email alert for danger-level anomalies
    const alertsWithIds = (insertedAlerts || []).map((inserted: any, i: number) => ({
      ...newAlerts[i],
      id: inserted.id,
    }));
    await sendDeclineAlert(supabase, userId, domain, alertsWithIds);
  }

  return newAlerts.length;
}