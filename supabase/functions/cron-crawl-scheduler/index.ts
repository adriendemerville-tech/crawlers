/**
 * cron-crawl-scheduler — Planificateur automatique de crawls
 *
 * Lancé quotidiennement par pg_cron (03h).
 * Pour chaque `parmenion_targets` actif :
 *   - Si dernier crawl complet > 15j (ou jamais) → lance un FULL crawl (maxPages=300)
 *   - Sinon si dernier crawl ciblé > 5j → lance un crawl ciblé sur le répertoire le plus actif
 *
 * Stratégie de rotation : priorité aux répertoires actifs (pondéré par recent_pages).
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const FULL_INTERVAL_MS_DEFAULT = 15 * 86_400_000;
const TARGETED_INTERVAL_MS_DEFAULT = 5 * 86_400_000;

interface DirectoryStat {
  path: string;            // e.g. "/blog"
  recent_pages: number;    // pages publiées/modifiées récemment
  total_pages: number;
  last_crawled_at?: string | null;
}

async function discoverDirectories(supabase: any, domain: string): Promise<DirectoryStat[]> {
  // Source 1 : crawl_pages du dernier crawl (segmenter par 1er niveau de path)
  const { data: lastCrawl } = await supabase
    .from('site_crawls')
    .select('id')
    .ilike('domain', domain)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastCrawl?.id) return [];

  const { data: pages } = await supabase
    .from('crawl_pages')
    .select('path')
    .eq('crawl_id', lastCrawl.id)
    .limit(2000);

  if (!pages?.length) return [];

  const map = new Map<string, number>();
  for (const p of pages as any[]) {
    const path = (p.path || '/') as string;
    const seg = '/' + (path.split('/').filter(Boolean)[0] || '');
    if (seg === '/') continue;
    map.set(seg, (map.get(seg) || 0) + 1);
  }

  // "recent_pages" proxy = nombre total de pages dans le répertoire
  // (plus de pages = répertoire plus actif/important)
  return Array.from(map.entries())
    .filter(([, count]) => count >= 2)
    .map(([path, count]) => ({ path, total_pages: count, recent_pages: count }));
}


function pickNextDirectory(
  discovered: DirectoryStat[],
  stored: DirectoryStat[],
): DirectoryStat | null {
  if (!discovered.length) return null;
  const storedMap = new Map(stored.map(d => [d.path, d.last_crawled_at || null]));
  // Score = recent_pages * 10 + (jours depuis last_crawled) — priorité actifs ET stales
  const scored = discovered.map(d => {
    const lastAt = storedMap.get(d.path);
    const daysSince = lastAt ? (Date.now() - new Date(lastAt).getTime()) / 86_400_000 : 365;
    return { dir: d, score: d.recent_pages * 10 + daysSince };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.dir || null;
}

async function triggerCrawl(
  domain: string,
  userId: string,
  opts: { maxPages: number; urlFilter?: string },
): Promise<{ crawlId: string | null; error?: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/crawl-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        url: `https://${domain}`,
        maxPages: opts.maxPages,
        userId,
        forceRefresh: true,
        ...(opts.urlFilter ? { urlFilter: opts.urlFilter } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { crawlId: null, error: data.error || `HTTP ${res.status}` };
    }
    return { crawlId: data.crawlId || null };
  } catch (e) {
    return { crawlId: null, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(handleRequest(async (req: Request) => {
  try {
    // Auth : service role uniquement (cron) ou admin manuel
    const authHeader = req.headers.get('Authorization') || '';
    const isService = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___');
    if (!isService) {
      const { getAuthenticatedUser } = await import('../_shared/auth.ts');
      const auth = await getAuthenticatedUser(req);
      if (!auth?.isAdmin) return jsonError('Admin only', 403);
    }

    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = !!body.dry_run;
    const onlyDomain: string | null = body.only_domain || null;

    // 1) Tous les targets actifs
    let q = supabase
      .from('parmenion_targets')
      .select('domain, created_by_user_id')
      .eq('is_active', true)
      .eq('autopilot_enabled', true);
    if (onlyDomain) q = q.eq('domain', onlyDomain);
    const { data: targets, error: tErr } = await q;
    if (tErr) return jsonError(`targets query failed: ${tErr.message}`, 500);

    const results: any[] = [];
    const now = Date.now();

    for (const t of (targets || []) as any[]) {
      const domain = (t.domain as string).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      let userId: string | null = t.created_by_user_id;
      if (!userId) {
        // Fallback : récupère le user_id du dernier crawl existant pour ce domaine
        const { data: prev } = await supabase
          .from('site_crawls')
          .select('user_id')
          .ilike('domain', domain)
          .not('user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        userId = prev?.user_id || null;
      }
      if (!userId) {
        results.push({ domain, skipped: 'no_user_id' });
        continue;
      }


      // 2) Upsert schedule row
      const { data: sched } = await supabase
        .from('site_crawl_schedule')
        .select('*')
        .eq('domain', domain)
        .maybeSingle();

      if (!sched) {
        await supabase.from('site_crawl_schedule').insert({ domain, user_id: userId });
      }

      const fullIntervalMs = ((sched?.full_interval_days as number) || 15) * 86_400_000;
      const targetedIntervalMs = ((sched?.targeted_interval_days as number) || 5) * 86_400_000;
      const enabled = sched?.enabled !== false;
      if (!enabled) {
        results.push({ domain, skipped: 'disabled' });
        continue;
      }

      const lastFull = sched?.last_full_crawl_at ? new Date(sched.last_full_crawl_at).getTime() : 0;
      const lastTargeted = sched?.last_targeted_crawl_at ? new Date(sched.last_targeted_crawl_at).getTime() : 0;
      const fullStale = !lastFull || (now - lastFull) > fullIntervalMs;
      const targetedStale = !lastTargeted || (now - lastTargeted) > targetedIntervalMs;

      // 2bis) FILE D'ATTENTE — vérifie qu'aucun crawl n'est en cours pour ce domaine.
      // Règle de priorité :
      //   1. Full crawl in-flight → bloque TOUT (full + targeted) jusqu'à completion
      //   2. Targeted crawl in-flight → bloque tout nouveau crawl (full attendra le prochain run)
      //   3. Aucun in-flight → déclenche selon staleness (full > targeted)
      // Le cron tournant chaque jour, un crawl reporté sera retenté au run suivant.
      const { data: inFlight } = await supabase
        .from('site_crawls')
        .select('id, status, url_filter, created_at')
        .ilike('domain', domain)
        .in('status', ['pending', 'processing', 'queued'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inFlight) {
        const kind = (inFlight as any).url_filter ? 'targeted' : 'full';
        results.push({
          domain,
          skipped: 'crawl_in_flight',
          in_flight_kind: kind,
          in_flight_id: (inFlight as any).id,
          in_flight_status: (inFlight as any).status,
        });
        continue;
      }

      // 3) Décision : full > targeted (un seul par run pour respecter quotas)
      if (fullStale) {
        if (dryRun) {
          results.push({ domain, action: 'full_crawl', age_days: lastFull ? Math.round((now - lastFull) / 86_400_000) : null, dry: true });
          continue;
        }
        const { crawlId, error } = await triggerCrawl(domain, userId, { maxPages: 300 });
        if (crawlId) {
          await supabase.from('site_crawl_schedule').update({
            last_full_crawl_at: new Date().toISOString(),
            last_full_crawl_id: crawlId,
          }).eq('domain', domain);
        }
        results.push({ domain, action: 'full_crawl', crawl_id: crawlId, error });
      } else if (targetedStale) {
        const discovered = await discoverDirectories(supabase, domain);
        const storedDirs = (sched?.directories as DirectoryStat[]) || [];
        const next = pickNextDirectory(discovered, storedDirs);
        if (!next) {
          results.push({ domain, skipped: 'no_directories' });
          continue;
        }
        if (dryRun) {
          results.push({ domain, action: 'targeted_crawl', directory: next.path, dry: true });
          continue;
        }
        // urlFilter regex échappée (path simple "/blog" → "^/blog/?")
        const escaped = next.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const urlFilter = `^${escaped}(/|$)`;
        const { crawlId, error } = await triggerCrawl(domain, userId, { maxPages: 80, urlFilter });
        if (crawlId) {
          // Met à jour le timestamp du répertoire dans la liste stockée
          const updatedDirs = discovered.map(d => ({
            ...d,
            last_crawled_at: d.path === next.path ? new Date().toISOString() : (storedDirs.find(s => s.path === d.path)?.last_crawled_at || null),
          }));
          await supabase.from('site_crawl_schedule').update({
            last_targeted_crawl_at: new Date().toISOString(),
            last_targeted_directory: next.path,
            directories: updatedDirs,
          }).eq('domain', domain);
        }
        results.push({ domain, action: 'targeted_crawl', directory: next.path, crawl_id: crawlId, error });
      } else {
        results.push({
          domain,
          skipped: 'up_to_date',
          full_age_days: lastFull ? Math.round((now - lastFull) / 86_400_000) : null,
          targeted_age_days: lastTargeted ? Math.round((now - lastTargeted) / 86_400_000) : null,
        });
      }
    }

    return jsonOk({ success: true, processed: results.length, results });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 500);
  }
}));
