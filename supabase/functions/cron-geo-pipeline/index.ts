/**
 * cron-geo-pipeline — Sprint 2 GEO scheduler
 *
 * Itère sur tous les sites avec un bouclier Cloudflare actif et invoque
 * la fonction GEO demandée. Conçue pour être appelée par pg_cron + pg_net.
 *
 * Body : { task: 'geo-kpis-aggregate' | 'compute-ai-referral-ctr' | 'snapshot-geo-visibility' }
 *
 * Pour snapshot-geo-visibility : ne traite qu'un site par jour (rotation par
 * date) afin de respecter le budget OpenRouter.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Task = 'geo-kpis-aggregate' | 'compute-ai-referral-ctr' | 'snapshot-geo-visibility';

const KNOWN_TASKS: Task[] = ['geo-kpis-aggregate', 'compute-ai-referral-ctr', 'snapshot-geo-visibility'];

Deno.serve(handleRequest(async (req) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  let body: { task?: Task } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const task = body.task;
  if (!task || !KNOWN_TASKS.includes(task)) {
    return jsonError(`task must be one of ${KNOWN_TASKS.join(', ')}`, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Sites avec Shield actif
  const { data: configs, error: cfgErr } = await supabase
    .from('cf_shield_configs')
    .select('tracked_site_id, user_id, domain, status')
    .eq('status', 'active');

  if (cfgErr) return jsonError(cfgErr.message, 500);

  const sites = configs || [];
  if (sites.length === 0) {
    return jsonOk({ ok: true, task, processed: 0, skipped: 'no-active-shields' });
  }

  // 2. Pour snapshot-geo-visibility : rotation 1 site/jour pour limiter le coût
  let targets = sites;
  if (task === 'snapshot-geo-visibility') {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % sites.length;
    targets = [sites[idx]];
  }

  // 3. Invocation séquentielle (latence > débit pour éviter rate-limits)
  const results: Array<{ site_id: string; domain: string; ok: boolean; error?: string }> = [];
  const startedAt = Date.now();
  const BUDGET_MS = 8 * 60 * 1000; // 8 min hard cap

  for (const site of targets) {
    if (Date.now() - startedAt > BUDGET_MS) {
      results.push({ site_id: site.tracked_site_id, domain: site.domain, ok: false, error: 'budget-exceeded' });
      continue;
    }

    try {
      const payload: Record<string, unknown> = { tracked_site_id: site.tracked_site_id };
      if (task === 'snapshot-geo-visibility') {
        payload.domain = site.domain;
        payload.user_id = site.user_id;
        payload.measurement_phase = 'periodic';
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/${task}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const ok = r.ok;
      results.push({
        site_id: site.tracked_site_id,
        domain: site.domain,
        ok,
        error: ok ? undefined : `HTTP ${r.status}`,
      });

      // throttle 1.5s entre sites
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      results.push({
        site_id: site.tracked_site_id,
        domain: site.domain,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return jsonOk({
    ok: true,
    task,
    total_sites_active: sites.length,
    processed: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    duration_ms: Date.now() - startedAt,
    results,
  });
}, 'cron-geo-pipeline'));
