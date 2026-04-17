/**
 * compute-ai-referral-ctr — Sprint 2 GEO (daily cron)
 *
 * For every site that has the Cloudflare shield active:
 *   1. Count AI bot hits in the rolling 7-day window (per site).
 *   2. Pull GSC weekly clicks/impressions from gsc_history_log.
 *   3. Compute:
 *        - ai_referral_ctr        = AI-driven clicks / AI-driven impressions
 *          (proxy: human clicks logged in bot_hits where referer matches an AI source)
 *        - ai_requests_per_100_visits via RPC compute_ai_traffic_ratio
 *   4. Upsert the current week's row in geo_kpi_snapshots.
 *
 * Designed to be called by a daily cron (pg_cron + pg_net).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const AI_REFERER_PATTERNS = [
  /chat\.openai\.com/i,
  /chatgpt\.com/i,
  /perplexity\.ai/i,
  /claude\.ai/i,
  /gemini\.google\.com/i,
  /copilot\.microsoft/i,
  /you\.com/i,
  /phind\.com/i,
];

function isAiReferer(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return AI_REFERER_PATTERNS.some(p => p.test(ref));
}

function getISOWeekStart(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().split('T')[0];
}

Deno.serve(handleRequest(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Optional filter: { tracked_site_id?: string }
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { /* empty */ }
  }
  const onlySiteId = body.tracked_site_id as string | undefined;

  // 1. Active sites with bouclier
  let configsQuery = supabase
    .from('cf_shield_configs')
    .select('tracked_site_id, user_id, domain, status')
    .in('status', ['active', 'pending']);

  if (onlySiteId) configsQuery = configsQuery.eq('tracked_site_id', onlySiteId);

  const { data: configs, error: cfgErr } = await configsQuery;
  if (cfgErr) return jsonError(cfgErr.message, 500);
  if (!configs || configs.length === 0) {
    return jsonOk({ ok: true, processed: 0, message: 'No active shields' });
  }

  const weekStart = getISOWeekStart(new Date());
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const results: Array<{ tracked_site_id: string; ai_referral_ctr: number | null; ai_per_100: number | null; error?: string }> = [];

  for (const cfg of configs) {
    try {
      // 2. AI bot impressions (= AI bot hits in 7d)
      const { count: aiBotHits } = await supabase
        .from('bot_hits')
        .select('id', { count: 'exact', head: true })
        .eq('tracked_site_id', cfg.tracked_site_id)
        .eq('is_ai_bot', true)
        .gte('hit_at', since7d);

      // 3. AI-attributed human clicks (sampled humans whose referer is an AI source)
      const { data: humanSamples } = await supabase
        .from('bot_hits')
        .select('referer')
        .eq('tracked_site_id', cfg.tracked_site_id)
        .eq('is_human_sample', true)
        .gte('hit_at', since7d)
        .not('referer', 'is', null)
        .limit(5000);

      const aiClicks = (humanSamples || []).filter(h => isAiReferer(h.referer)).length;

      // 4. CTR = AI clicks / AI bot impressions (proxy)
      const ai_referral_ctr = (aiBotHits && aiBotHits > 0)
        ? Math.round((aiClicks / aiBotHits) * 10000) / 100  // % with 2 decimals
        : null;

      // 5. AI requests / 100 visits via RPC
      const { data: ratioData } = await supabase.rpc('compute_ai_traffic_ratio', {
        p_tracked_site_id: cfg.tracked_site_id,
        p_window_days: 7,
      });
      const ai_per_100 = (ratioData && typeof ratioData === 'object' && 'ai_per_100_visits' in ratioData)
        ? (ratioData.ai_per_100_visits as number | null)
        : null;

      // 6. Upsert into geo_kpi_snapshots (only patch the two fields)
      const { data: existing } = await supabase
        .from('geo_kpi_snapshots')
        .select('id')
        .eq('tracked_site_id', cfg.tracked_site_id)
        .eq('week_start_date', weekStart)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('geo_kpi_snapshots')
          .update({
            ai_referral_ctr,
            ai_requests_per_100_visits: ai_per_100,
            computed_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('geo_kpi_snapshots').insert({
          tracked_site_id: cfg.tracked_site_id,
          user_id: cfg.user_id,
          domain: cfg.domain,
          week_start_date: weekStart,
          ai_referral_ctr,
          ai_requests_per_100_visits: ai_per_100,
          computed_at: new Date().toISOString(),
        });
      }

      results.push({
        tracked_site_id: cfg.tracked_site_id,
        ai_referral_ctr,
        ai_per_100,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[compute-ai-referral-ctr] site=${cfg.tracked_site_id}`, msg);
      results.push({ tracked_site_id: cfg.tracked_site_id, ai_referral_ctr: null, ai_per_100: null, error: msg });
    }
  }

  return jsonOk({
    ok: true,
    week_start: weekStart,
    processed: results.length,
    results,
  });
}, 'compute-ai-referral-ctr'));
