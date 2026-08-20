import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * API du lot multipages Marina. L'orchestration vit côté serveur : le front
 * crée un lot, lit son état, et peut l'annuler. Aucune boucle de lancement
 * côté navigateur — fermer l'onglet n'interrompt plus rien.
 */

const MAX_URLS = 15;

function normalizeUrl(raw: string): string | null {
  const trimmed = String(raw || '').trim().replace(/[,;]+$/, '');
  if (!trimmed) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Crée le lot et ses URLs. Le premier lancement est déclenché immédiatement. */
export const createMarinaBatch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { urls: string[]; lang?: string }) => {
    const urls = [...new Set((input?.urls || []).map(normalizeUrl).filter((u): u is string => Boolean(u)))];
    if (urls.length < 2) throw new Error('Au moins 2 URLs valides sont requises');
    const hosts = new Set(urls.map((u) => new URL(u).hostname.replace(/^www\./, '')));
    if (hosts.size > 1) throw new Error('Toutes les URLs doivent appartenir au même domaine');
    return { urls: urls.slice(0, MAX_URLS), lang: (input?.lang || 'fr').slice(0, 8) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { advanceBatch } = await import('./batchEngine.server');
    const domain = new URL(data.urls[0]).hostname.replace(/^www\./, '');

    const { data: batch, error } = await supabaseAdmin
      .from('marina_batches')
      .insert({
        user_id: context.userId,
        domain,
        lang: data.lang,
        item_count: data.urls.length,
      } as never)
      .select('id')
      .single();
    if (error || !batch) throw new Error(error?.message || 'Création du lot impossible');

    const batchId = (batch as { id: string }).id;
    const { error: itemsError } = await supabaseAdmin.from('marina_batch_items').insert(
      data.urls.map((url, position) => ({
        batch_id: batchId,
        user_id: context.userId,
        url,
        position,
      })) as never,
    );
    if (itemsError) throw new Error(itemsError.message);

    // Premier cran tout de suite : l'utilisateur voit une URL démarrer.
    await advanceBatch(supabaseAdmin, batchId);
    return { batchId };
  });

/**
 * État courant d'un lot. La lecture avance aussi le lot d'un cran : onglet
 * ouvert, la file progresse sans attendre le cron ; onglet fermé, le cron s'en
 * charge. `advanceBatch` est protégé par un bail, les deux ne se doublent pas.
 */
export const getMarinaBatch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => {
    if (!input?.batchId || typeof input.batchId !== 'string') throw new Error('batchId requis');
    return { batchId: input.batchId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { advanceBatch } = await import('./batchEngine.server');

    const { data: batch } = await supabaseAdmin
      .from('marina_batches')
      .select('id, user_id, domain, lang, status, item_count, created_at')
      .eq('id', data.batchId)
      .maybeSingle();
    const b = batch as any;
    if (!b || b.user_id !== context.userId) throw new Error('Lot introuvable');

    if (b.status === 'running') await advanceBatch(supabaseAdmin, data.batchId);

    const { data: rows } = await supabaseAdmin
      .from('marina_batch_items')
      .select('url, position, job_id, status, progress, error')
      .eq('batch_id', data.batchId)
      .order('position', { ascending: true });

    const items = (rows || []).map((r: any) => ({
      url: String(r.url),
      position: Number(r.position),
      jobId: (r.job_id as string | null) ?? null,
      status: String(r.status) as 'pending' | 'running' | 'completed' | 'partial' | 'failed',
      progress: Number(r.progress ?? 0),
      error: (r.error as string | null) ?? null,
    }));

    return {
      batchId: String(b.id),
      domain: String(b.domain),
      status: String(b.status),
      createdAt: String(b.created_at),
      items,
    };
  });

/** Dernier lot de l'utilisateur, pour recoller l'affichage après rechargement. */
export const getLatestMarinaBatch = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('marina_batches')
      .select('id, created_at')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { batchId: (data as any)?.id ? String((data as any).id) : null };
  });

/** Arrête la file d'un lot. Les audits déjà lancés se terminent côté serveur. */
export const cancelMarinaBatch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => {
    if (!input?.batchId || typeof input.batchId !== 'string') throw new Error('batchId requis');
    return { batchId: input.batchId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('marina_batches')
      .update({ status: 'cancelled', lock_until: null, updated_at: new Date().toISOString() } as never)
      .eq('id', data.batchId)
      .eq('user_id', context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Relance les URLs en échec d'un lot (le forfait a déjà été débité). */
export const retryMarinaBatchFailures = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => {
    if (!input?.batchId || typeof input.batchId !== 'string') throw new Error('batchId requis');
    return { batchId: input.batchId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { advanceBatch } = await import('./batchEngine.server');

    const { error } = await supabaseAdmin
      .from('marina_batch_items')
      .update({
        status: 'pending',
        job_id: null,
        progress: 0,
        error: null,
        launch_attempts: 0,
        launched_at: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('batch_id', data.batchId)
      .eq('user_id', context.userId)
      .eq('status', 'failed');
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from('marina_batches')
      .update({ status: 'running', lock_until: null, updated_at: new Date().toISOString() } as never)
      .eq('id', data.batchId)
      .eq('user_id', context.userId);

    await advanceBatch(supabaseAdmin, data.batchId);
    return { ok: true };
  });
