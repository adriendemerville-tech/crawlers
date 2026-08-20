/**
 * batchEngine.server.ts — orchestration serveur des audits Marina multipages.
 *
 * Le lot ne vit plus dans l'onglet du navigateur. Il est déclaré en base
 * (`marina_batches` / `marina_batch_items`) et avancé ici :
 *   1. réconciliation de chaque URL avec son job réel (`async_jobs`) ;
 *   2. lancement des URLs restantes tant qu'un créneau est libre ;
 *   3. clôture du lot quand toutes les URLs sont dans un état terminal.
 *
 * Le moteur est appelé de deux endroits, avec le même verrou : le cron
 * (progression garantie onglet fermé) et la lecture d'état par l'interface
 * (réactivité quand l'onglet est ouvert). Il est borné par run : au plus
 * `MAX_LAUNCHES_PER_TICK` lancements, et un seul toutes les `STAGGER_MS`
 * pour que le crawl mutualisé du domaine soit enregistré avant la suite.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Créneaux simultanés par lot (le moteur Marina plafonne aussi globalement). */
const DEFAULT_CONCURRENCY = 2;
/** Lancements maximum par passage — borne le travail d'un run. */
const MAX_LAUNCHES_PER_TICK = 2;
/** Décalage minimal entre deux lancements du même lot. */
const STAGGER_MS = 20_000;
/** Durée du bail de single-flight sur un lot. */
const LEASE_MS = 2 * 60 * 1000;
/** Tentatives de lancement d'une URL avant abandon. */
const MAX_LAUNCH_ATTEMPTS = 3;

export type ItemStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

const TERMINAL: ItemStatus[] = ['completed', 'partial', 'failed'];

interface ItemRow {
  id: string;
  url: string;
  position: number;
  job_id: string | null;
  status: ItemStatus;
  progress: number;
  error: string | null;
  launch_attempts: number;
  launched_at: string | null;
}

export interface AdvanceResult {
  batchId: string;
  launched: number;
  reconciled: number;
  status: string;
}

/**
 * Bail exclusif sur un lot : un second run sort au lieu de travailler en double.
 *
 * Le bail est pris en deux temps (lecture puis écriture conditionnée sur la
 * valeur lue). L'API Data refuse un filtre `or(...)` sur une écriture — il
 * répondait « column lock_until does not exist » et le bail échouait toujours,
 * ce qui figeait la file entière à « en attente ».
 */
async function acquireLease(sb: SupabaseClient, batchId: string): Promise<boolean> {
  const now = new Date();
  const { data: current } = await sb
    .from('marina_batches')
    .select('lock_until')
    .eq('id', batchId)
    .maybeSingle();
  const prev = (current as { lock_until: string | null } | null)?.lock_until ?? null;
  if (prev && new Date(prev).getTime() > now.getTime()) return false;

  const next = new Date(now.getTime() + LEASE_MS).toISOString();
  let q = sb
    .from('marina_batches')
    .update({ lock_until: next } as never)
    .eq('id', batchId);
  q = prev === null ? q.is('lock_until', null) : q.eq('lock_until', prev);
  const { data } = await q.select('id');
  return Array.isArray(data) && data.length > 0;
}


async function releaseLease(sb: SupabaseClient, batchId: string): Promise<void> {
  await sb.from('marina_batches').update({ lock_until: null } as never).eq('id', batchId);
}

/** Aligne l'état stocké de chaque URL sur celui de son job Marina. */
async function reconcile(sb: SupabaseClient, items: ItemRow[]): Promise<number> {
  const withJobs = items.filter((i) => i.job_id && !TERMINAL.includes(i.status));
  if (!withJobs.length) return 0;

  const { data: jobs } = await sb
    .from('async_jobs')
    .select('id, status, progress, error_message')
    .in('id', withJobs.map((i) => i.job_id as string));

  const byId = new Map((jobs || []).map((j: any) => [String(j.id), j]));
  let changed = 0;

  for (const item of withJobs) {
    const job = byId.get(String(item.job_id));
    if (!job) continue;
    const jobStatus = String(job.status);
    let next: Partial<ItemRow> | null = null;

    if (jobStatus === 'completed' || jobStatus === 'partial') {
      next = { status: jobStatus as ItemStatus, progress: 100, error: null };
    } else if (jobStatus === 'failed') {
      next = { status: 'failed', error: job.error_message || 'Échec de la génération' };
    } else if (Number(job.progress ?? 0) !== item.progress || item.status !== 'running') {
      next = { status: 'running', progress: Number(job.progress ?? 0) };
    }

    if (!next) continue;
    await sb
      .from('marina_batch_items')
      .update({ ...next, updated_at: new Date().toISOString() } as never)
      .eq('id', item.id);
    Object.assign(item, next);
    changed += 1;
  }
  return changed;
}

/** Lance l'audit Marina d'une URL et rattache le job à l'URL du lot. */
async function launchItem(
  sb: SupabaseClient,
  item: ItemRow,
  batch: { id: string; user_id: string; lang: string; item_count: number },
): Promise<boolean> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !serviceKey) return false;

  const attempts = item.launch_attempts + 1;
  await sb
    .from('marina_batch_items')
    .update({
      launch_attempts: attempts,
      launched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', item.id);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/marina`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        // Second canal d'authentification serveur : les deux clés de service
        // peuvent différer de format, le secret interne tranche.
        ...(process.env['CRON_SECRET'] ? { 'x-internal-secret': process.env['CRON_SECRET'] as string } : {}),
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        url: item.url,
        lang: batch.lang,
        // Le job appartient au propriétaire du lot, pas au service.
        user_id: batch.user_id,
        batch_id: batch.id,
        batch_size: batch.item_count,
        batch_index: item.position,
      }),
    });
    const data = (await res.json()) as { job_id?: string; error?: string };
    if (!data.job_id) throw new Error(data.error || 'Lancement impossible');

    await sb
      .from('marina_batch_items')
      .update({
        job_id: data.job_id,
        status: 'running',
        progress: 0,
        error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', item.id);
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (attempts >= MAX_LAUNCH_ATTEMPTS) {
      await sb
        .from('marina_batch_items')
        .update({ status: 'failed', error: message, updated_at: new Date().toISOString() } as never)
        .eq('id', item.id);
    }
    return false;
  }
}

/**
 * Fait progresser un lot d'un cran. Idempotent et borné : appelable aussi
 * souvent que voulu, par le cron comme par l'interface.
 */
export async function advanceBatch(sb: SupabaseClient, batchId: string): Promise<AdvanceResult | null> {
  const { data: batch } = await sb
    .from('marina_batches')
    .select('id, user_id, lang, status, concurrency, item_count')
    .eq('id', batchId)
    .maybeSingle();
  if (!batch) return null;

  const b = batch as any;
  if (b.status !== 'running') {
    return { batchId, launched: 0, reconciled: 0, status: String(b.status) };
  }
  if (!(await acquireLease(sb, batchId))) {
    return { batchId, launched: 0, reconciled: 0, status: 'running' };
  }

  try {
    const { data: rows } = await sb
      .from('marina_batch_items')
      .select('id, url, position, job_id, status, progress, error, launch_attempts, launched_at')
      .eq('batch_id', batchId)
      .order('position', { ascending: true });
    const items = (rows || []) as unknown as ItemRow[];

    const reconciled = await reconcile(sb, items);

    const inFlight = items.filter((i) => i.status === 'running' || (i.job_id && !TERMINAL.includes(i.status)));
    const pending = items.filter((i) => i.status === 'pending' && !i.job_id);
    const concurrency = Number(b.concurrency) || DEFAULT_CONCURRENCY;

    // Décalage : on n'enchaîne pas deux lancements coup sur coup, le premier
    // audit du domaine doit avoir enregistré son crawl mutualisé.
    const lastLaunch = items
      .map((i) => (i.launched_at ? new Date(i.launched_at).getTime() : 0))
      .reduce((a, c) => Math.max(a, c), 0);
    const staggerReady = Date.now() - lastLaunch > STAGGER_MS;

    let launched = 0;
    if (staggerReady) {
      const slots = Math.max(0, Math.min(concurrency - inFlight.length, MAX_LAUNCHES_PER_TICK));
      for (const item of pending.slice(0, slots)) {
        const ok = await launchItem(sb, item, {
          id: b.id,
          user_id: b.user_id,
          lang: b.lang || 'fr',
          item_count: Number(b.item_count) || items.length,
        });
        if (ok) launched += 1;
        // Un seul lancement par passage : le décalage est réévalué au suivant.
        break;
      }
    }

    // Relance d'un lancement resté sans job (réponse perdue) sous le plafond.
    const stuck = items.filter(
      (i) => i.status === 'pending' && !i.job_id && i.launched_at && i.launch_attempts < MAX_LAUNCH_ATTEMPTS,
    );

    const { data: fresh } = await sb
      .from('marina_batch_items')
      .select('status')
      .eq('batch_id', batchId);
    const allTerminal =
      (fresh || []).length > 0 &&
      (fresh || []).every((r: any) => TERMINAL.includes(String(r.status) as ItemStatus));

    let status = 'running';
    if (allTerminal) {
      status = 'completed';
      await sb
        .from('marina_batches')
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq('id', batchId);
    } else {
      await sb.from('marina_batches').update({ updated_at: new Date().toISOString() } as never).eq('id', batchId);
    }

    void stuck; // réessayé au passage suivant par le chemin `pending` ci-dessus
    return { batchId, launched, reconciled, status };
  } finally {
    await releaseLease(sb, batchId);
  }
}

/**
 * Avance tous les lots actifs — point d'entrée du cron. Borné à `maxBatches`
 * lots par run pour ne jamais dépasser le temps d'exécution disponible.
 */
export async function advanceActiveBatches(
  sb: SupabaseClient,
  maxBatches = 5,
): Promise<AdvanceResult[]> {
  const { data: batches } = await sb
    .from('marina_batches')
    .select('id')
    .eq('status', 'running')
    .order('updated_at', { ascending: true })
    .limit(maxBatches);

  const out: AdvanceResult[] = [];
  for (const row of batches || []) {
    const res = await advanceBatch(sb, String((row as any).id));
    if (res) out.push(res);
  }
  return out;
}
