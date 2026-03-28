import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * content-perf-aggregator — Weekly cron function
 *
 * Two jobs:
 * 1. MEASURE: Enrich content_generation_logs with GSC/GA4/GEO/LLM deltas at T+30 and T+90
 * 2. AGGREGATE: Build anonymous cross-user correlations in content_performance_correlations
 *
 * Triggered weekly by pg_cron. No user auth required (service key).
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();

    // ═══ PHASE 1: MEASURE — Fill performance deltas on mature logs ═══
    const now = new Date();
    const t30Cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const t90Cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Logs needing T+30 measurement (created 30+ days ago, not yet measured at T30)
    const { data: logsT30 } = await supabase
      .from('content_generation_logs')
      .select('id, domain, tracked_site_id, target_url, created_at')
      .eq('measurement_phase', 'pending')
      .lt('created_at', t30Cutoff.toISOString())
      .limit(50);

    let measuredT30 = 0;
    for (const log of logsT30 || []) {
      try {
        // Fetch GSC baseline (around creation) and T30
        const { data: gscBaseline } = await supabase
          .from('gsc_weekly_snapshots')
          .select('clicks, impressions, ctr, position')
          .eq('tracked_site_id', log.tracked_site_id)
          .lte('week_start_date', log.created_at)
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: gscT30 } = await supabase
          .from('gsc_weekly_snapshots')
          .select('clicks, impressions, ctr, position')
          .eq('tracked_site_id', log.tracked_site_id)
          .gte('week_start_date', t30Cutoff.toISOString())
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch GEO score
        const { data: geoBaseline } = await supabase
          .from('cocoon_diagnostic_results')
          .select('scores')
          .eq('tracked_site_id', log.tracked_site_id)
          .lte('created_at', log.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch LLM visibility
        const { data: llmBaseline } = await supabase
          .from('llm_visibility_snapshots')
          .select('composite_score')
          .eq('tracked_site_id', log.tracked_site_id)
          .lte('measured_at', log.created_at)
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase
          .from('content_generation_logs')
          .update({
            gsc_clicks_baseline: gscBaseline?.clicks ?? null,
            gsc_ctr_baseline: gscBaseline?.ctr ?? null,
            gsc_clicks_t30: gscT30?.clicks ?? null,
            geo_score_baseline: extractGeoScore(geoBaseline?.scores),
            llm_visibility_baseline: (llmBaseline as any)?.composite_score ?? null,
            measurement_phase: 't30_done',
            measured_at: now.toISOString(),
          })
          .eq('id', log.id);

        measuredT30++;
      } catch (e) {
        console.warn(`[aggregator] T30 measure failed for ${log.id}:`, e);
      }
    }

    // Logs needing T+90 measurement
    const { data: logsT90 } = await supabase
      .from('content_generation_logs')
      .select('id, domain, tracked_site_id, target_url, created_at')
      .eq('measurement_phase', 't30_done')
      .lt('created_at', t90Cutoff.toISOString())
      .limit(50);

    let measuredT90 = 0;
    for (const log of logsT90 || []) {
      try {
        const { data: gscT90 } = await supabase
          .from('gsc_weekly_snapshots')
          .select('clicks, ctr')
          .eq('tracked_site_id', log.tracked_site_id)
          .gte('week_start_date', t90Cutoff.toISOString())
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: geoT90 } = await supabase
          .from('cocoon_diagnostic_results')
          .select('scores')
          .eq('tracked_site_id', log.tracked_site_id)
          .gte('created_at', t90Cutoff.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: llmT90 } = await supabase
          .from('llm_visibility_snapshots')
          .select('composite_score')
          .eq('tracked_site_id', log.tracked_site_id)
          .gte('measured_at', t90Cutoff.toISOString())
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase
          .from('content_generation_logs')
          .update({
            gsc_clicks_t90: gscT90?.clicks ?? null,
            gsc_ctr_t90: gscT90?.ctr ?? null,
            geo_score_t90: extractGeoScore(geoT90?.scores),
            llm_visibility_t90: (llmT90 as any)?.composite_score ?? null,
            measurement_phase: 'complete',
            measured_at: now.toISOString(),
          })
          .eq('id', log.id);

        measuredT90++;
      } catch (e) {
        console.warn(`[aggregator] T90 measure failed for ${log.id}:`, e);
      }
    }

    // ═══ PHASE 2: AGGREGATE — Build anonymous correlations ═══
    const weekStart = getWeekStart(now);

    // Delete existing aggregation for this week (idempotent)
    await supabase
      .from('content_performance_correlations')
      .delete()
      .eq('week_start', weekStart);

    // Aggregate complete logs by page_type × market_sector × tone × angle
    const { data: completeLogs } = await supabase
      .from('content_generation_logs')
      .select('page_type, market_sector, brief_tone, brief_angle, brief_length_target, brief_h2_count, brief_cta_count, brief_internal_links_count, brief_geo_passages, gsc_clicks_baseline, gsc_clicks_t90, gsc_ctr_baseline, gsc_ctr_t90, geo_score_baseline, geo_score_t90, llm_visibility_baseline, llm_visibility_t90')
      .eq('measurement_phase', 'complete')
      .not('gsc_clicks_baseline', 'is', null)
      .not('gsc_clicks_t90', 'is', null);

    if (completeLogs && completeLogs.length > 0) {
      // Group by page_type × market_sector × tone × angle
      const groups = new Map<string, any[]>();
      for (const log of completeLogs) {
        const key = `${log.page_type}|${log.market_sector || 'unknown'}|${log.brief_tone || 'default'}|${log.brief_angle || 'default'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(log);
      }

      const correlations: any[] = [];
      for (const [key, logs] of groups) {
        const [pageType, sector, tone, angle] = key.split('|');
        const n = logs.length;

        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const delta = (baseline: string, t90: string) =>
          avg(logs.filter(l => l[baseline] != null && l[t90] != null).map(l => l[t90] - l[baseline]));

        const sampleCount = n;
        const grade = sampleCount >= 20 ? 'A' : sampleCount >= 10 ? 'B' : sampleCount >= 5 ? 'C' : 'F';

        correlations.push({
          page_type: pageType,
          market_sector: sector,
          tone,
          angle,
          avg_length_target: avg(logs.map(l => l.brief_length_target).filter(Boolean)),
          avg_h2_count: avg(logs.map(l => l.brief_h2_count).filter(Boolean)),
          avg_cta_count: avg(logs.map(l => l.brief_cta_count).filter(Boolean)),
          avg_internal_links: avg(logs.map(l => l.brief_internal_links_count).filter(Boolean)),
          avg_geo_passages: avg(logs.map(l => l.brief_geo_passages).filter(Boolean)),
          avg_gsc_clicks_delta: delta('gsc_clicks_baseline', 'gsc_clicks_t90'),
          avg_gsc_ctr_delta: delta('gsc_ctr_baseline', 'gsc_ctr_t90'),
          avg_ga4_sessions_delta: null, // TODO: add GA4 measurement
          avg_ga4_conversions_delta: null,
          avg_geo_score_delta: delta('geo_score_baseline', 'geo_score_t90'),
          avg_llm_visibility_delta: delta('llm_visibility_baseline', 'llm_visibility_t90'),
          sample_count: sampleCount,
          confidence_grade: grade,
          week_start: weekStart,
        });
      }

      if (correlations.length > 0) {
        const { error } = await supabase
          .from('content_performance_correlations')
          .insert(correlations);
        if (error) console.error('[aggregator] Insert correlations error:', error);
      }

      console.log(`[aggregator] Aggregated ${correlations.length} correlation groups from ${completeLogs.length} complete logs`);
    }

    const result = {
      measured_t30: measuredT30,
      measured_t90: measuredT90,
      pending_t30: (logsT30 || []).length,
      pending_t90: (logsT90 || []).length,
      complete_logs: (completeLogs || []).length,
      week_start: weekStart,
    };

    console.log(`[aggregator] Done:`, result);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[aggregator] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractGeoScore(scores: any): number | null {
  if (!scores) return null;
  if (typeof scores === 'object') {
    return scores.geo_score ?? scores.overall ?? scores.citability ?? null;
  }
  return null;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
