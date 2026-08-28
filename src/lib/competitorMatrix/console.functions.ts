// Module « Concurrence » de la console : suivi de plusieurs URL d'un même
// domaine avec les outils de la matrice de concurrence.
// Pas de quota IP ici : l'accès est authentifié et les jobs sont rattachés à l'utilisateur.
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const listConsoleMatrices = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string }) => input)
  .handler(async ({ data, context }) => {
    const { toConsoleRow } = await import('./console.server');
    const { cleanDomain } = await import('./dfs.server');
    const domain = cleanDomain(String(data.domain || ''));
    if (!domain) return { rows: [] };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Rattachement des analyses lancées depuis /matrice-concurrence (anonymes) :
    // uniquement si l'utilisateur suit réellement ce domaine dans sa console.
    const { data: owned } = await supabaseAdmin
      .from('tracked_sites')
      .select('id')
      .eq('user_id', context.userId)
      .eq('domain', domain)
      .limit(1);
    if ((owned?.length ?? 0) > 0) {
      await supabaseAdmin
        .from('competitor_matrix_jobs')
        .update({ user_id: context.userId } as never)
        .eq('domain', domain)
        .is('user_id', null);
    }

    const { data: rows } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id, target_url, domain, status, step, progress, created_at, updated_at, competitors, error, matrix')
      .eq('user_id', context.userId)
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(50);
    return { rows: (rows ?? []).map(toConsoleRow) };
  });


export const startConsoleMatrix = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; domain: string; competitors?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { normalizeTargetUrl, toMatrixState } = await import('./console.server');
    const { cleanDomain } = await import('./dfs.server');
    const targetUrl = normalizeTargetUrl(data.url);
    if (!targetUrl) return { error: 'invalid_url' as const, message: 'URL invalide' };

    const urlDomain = cleanDomain(new URL(targetUrl).hostname);
    const siteDomain = cleanDomain(String(data.domain || ''));
    if (!siteDomain || urlDomain !== siteDomain) {
      return {
        error: 'domain_mismatch' as const,
        message: `L'URL doit appartenir au domaine sélectionné (${siteDomain || '—'}).`,
      };
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { count } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', context.userId)
      .eq('status', 'running');
    if ((count ?? 0) >= 2) {
      return { error: 'too_many_running' as const, message: 'Deux analyses tournent déjà. Attendez leur fin.' };
    }

    const competitors = (Array.isArray(data.competitors) ? data.competitors : [])
      .map((c) => cleanDomain(String(c)))
      .filter(Boolean)
      .slice(0, 3);

    const { data: job, error } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .insert({
        user_id: context.userId,
        share_token: crypto.randomUUID().replace(/-/g, ''),
        target_url: targetUrl,
        domain: urlDomain,
        status: 'running',
        step: 'identity',
        progress: 5,
        competitors: competitors.map((d) => ({
          domain: d, name: d, type: 'metier',
          reason: 'Concurrent désigné par l’utilisateur', source: 'user',
        })),
      })
      .select('*')
      .single();

    if (error || !job) {
      console.error('[console-competition] insert failed', error?.message);
      return { error: 'server_error' as const, message: 'Impossible de démarrer l’analyse.' };
    }
    return { job: toMatrixState(job) };
  });

export const getConsoleMatrix = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) => {
    const { toMatrixState } = await import('./console.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('id', String(data.jobId))
      .eq('user_id', context.userId)
      .maybeSingle();
    if (!job) return { error: 'not_found' as const, message: 'Analyse introuvable.' };
    return { job: toMatrixState(job) };
  });

export const deleteConsoleMatrix = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .delete()
      .eq('id', String(data.jobId))
      .eq('user_id', context.userId);
    if (error) return { error: 'server_error' as const, message: error.message };
    return { ok: true as const };
  });
