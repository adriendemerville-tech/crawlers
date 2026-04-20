/**
 * behavioral-rescore — Sprint B
 *
 * Cron quotidien : pour chaque IP ayant des hits "unverified" ou "suspect"
 * dans les 24h, on agrège son comportement et on ré-évalue le verdict.
 *
 * Cible : repérer les bots furtifs (`stealth`) qui n'ont ni rDNS officiel
 * ni UA reconnu mais qui crawlent à haute fréquence.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { applyBehavioralScoring, buildBehaviorContext } from '../_shared/behavioral-scoring.ts';

const WINDOW_HOURS = 24;
const MAX_IPS = 300;

Deno.serve(handleRequest(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const stats = { ips_processed: 0, promoted_stealth: 0, reinforced_suspect: 0, downgraded: 0 };

  // 1) Trouver les IPs candidates (unverified/suspect) du dernier jour
  const { data: candidates, error: candErr } = await supabase
    .from('log_entries')
    .select('ip')
    .or('verification_status.is.null,verification_status.in.(unverified,suspect)')
    .not('ip', 'is', null)
    .gte('ts', since)
    .limit(5000);

  if (candErr) return jsonError(candErr.message, 500);

  const uniqueIps = [...new Set((candidates || []).map(r => String(r.ip)).filter(Boolean))]
    .slice(0, MAX_IPS);

  // 2) Pour chaque IP, agrège son comportement et ré-évalue
  for (const ip of uniqueIps) {
    const { data: hits } = await supabase
      .from('log_entries')
      .select('id, path, referer, status_code, user_agent, verification_status, verification_method, confidence_score, bot_name, bot_category, is_bot')
      .eq('ip', ip)
      .gte('ts', since)
      .limit(500);

    if (!hits || hits.length === 0) continue;
    stats.ips_processed++;

    const ctx = buildBehaviorContext(hits as any[]);

    // Applique sur chaque hit candidat
    for (const h of hits as any[]) {
      const base = {
        status: (h.verification_status || 'unverified') as any,
        method: (h.verification_method || 'none') as any,
        confidence: h.confidence_score || 0,
        bot_name: h.bot_name,
        bot_category: h.bot_category,
        is_bot: h.is_bot,
      };
      const after = applyBehavioralScoring(base, ctx);

      // Skip si rien n'a changé
      if (after.status === base.status && after.confidence === base.confidence) continue;

      const patch: Record<string, unknown> = {
        verification_status: after.status,
        verification_method: after.method,
        confidence_score: Math.round(after.confidence),
      };
      if (after.is_bot && !base.is_bot) patch.is_bot = true;
      if (after.bot_name && !base.bot_name) patch.bot_name = after.bot_name;
      if (after.bot_category && !base.bot_category) patch.bot_category = after.bot_category;

      await supabase.from('log_entries').update(patch).eq('id', h.id);

      if (after.status === 'stealth' && base.status !== 'stealth') stats.promoted_stealth++;
      else if (after.status === 'suspect' && after.confidence > base.confidence) stats.reinforced_suspect++;
      else if (after.confidence < base.confidence) stats.downgraded++;
    }
  }

  console.log('[behavioral-rescore]', stats);
  return jsonOk({ ok: true, stats, window_hours: WINDOW_HOURS });
}, 'behavioral-rescore'));
