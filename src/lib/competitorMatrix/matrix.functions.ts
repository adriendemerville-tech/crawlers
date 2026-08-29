// Outil gratuit « Matrice Concurrence » — orchestration par étapes courtes.
// Le client appelle `advanceCompetitorMatrix` en boucle : chaque appel exécute
// UNE étape et rend la main, ce qui garde chaque requête sous la limite de temps
// du worker (pas de `EdgeRuntime.waitUntil` disponible ici).
// Toute la logique de quota et d'accès est serveur.
// Les helpers vivent dans `matrixRequest.server.ts` : le module scope d'un
// fichier de server functions est effacé par le découpage côté client.

import { createServerFn } from '@tanstack/react-start';

export const getCompetitorMatrixQuota = createServerFn({ method: 'GET' }).handler(async () => {
  const { isAdminRequest, hashIp, clientIp, MATRIX_FREE_QUOTA } = await import('./matrixRequest.server');
  if (await isAdminRequest()) {
    return { quota: 9999, used: 0, remaining: 9999, unlimited: true };
  }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('competitor_matrix_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', await hashIp(clientIp()))
    .gte('created_at', since);
  const used = count ?? 0;
  return { quota: MATRIX_FREE_QUOTA, used, remaining: Math.max(0, MATRIX_FREE_QUOTA - used) };
});


export const startCompetitorMatrix = createServerFn({ method: 'POST' })
  .inputValidator((input: { url: string; competitors?: string[] }) => input)
  .handler(async ({ data }) => {
    const { normalizeUrl, isAdminRequest, hashIp, clientIp, toState, MATRIX_FREE_QUOTA } =
      await import('./matrixRequest.server');
    const targetUrl = normalizeUrl(data.url);
    if (!targetUrl) return { error: 'invalid_url' as const, message: 'URL invalide' };

    const { cleanDomain } = await import('./dfs.server');
    const domain = cleanDomain(new URL(targetUrl).hostname);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ipHash = await hashIp(clientIp());

    const admin = await isAdminRequest();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = admin
      ? { count: 0 }
      : await supabaseAdmin
          .from('competitor_matrix_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash)
          .gte('created_at', since);
    if (!admin && (count ?? 0) >= MATRIX_FREE_QUOTA) {
      return {
        error: 'quota_exhausted' as const,
        message: 'Vous avez déjà généré votre matrice gratuite aujourd’hui. Créez un compte pour lancer un audit complet.',
      };
    }

    const userCompetitors = (Array.isArray(data.competitors) ? data.competitors : [])
      .map((c) => cleanDomain(String(c)))
      .filter(Boolean)
      .slice(0, 3);

    const { data: job, error } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .insert({
        share_token: crypto.randomUUID().replace(/-/g, ''),
        target_url: targetUrl,
        domain,
        status: 'running',
        step: 'identity',
        progress: 5,
        ip_hash: ipHash,
        competitors: userCompetitors.map((d) => ({
          domain: d, name: d, type: 'metier',
          reason: 'Concurrent désigné par l’utilisateur', source: 'user',
        })),
      })
      .select('*')
      .single();

    if (error || !job) {
      console.error('[competitor-matrix] insert failed', error?.message);
      return { error: 'server_error' as const, message: 'Impossible de démarrer l’analyse.' };
    }
    return { job: toState(job) };
  });

/**
 * Exécute une seule étape et renvoie l'état mis à jour.
 * Le client peut rappeler tant que `status === 'running'` ; le cron
 * `competitor-matrix-tick` fait la même chose en arrière-plan.
 */
export const advanceCompetitorMatrix = createServerFn({ method: 'POST' })
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data }) => {
    const jobId = String(data.jobId);
    const { hashIp, clientIp, isAdminRequest, toState } = await import('./matrixRequest.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Contrôle de propriété : seul le demandeur (même empreinte IP) ou un admin
    // peut faire avancer le job — sinon un tiers déclencherait des coûts LLM.
    const { data: owner } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id, ip_hash')
      .eq('id', jobId)
      .maybeSingle();
    if (!owner) return { error: 'not_found' as const, message: 'Analyse introuvable.' };

    const sameIp = owner.ip_hash === (await hashIp(clientIp()));
    if (!sameIp && !(await isAdminRequest())) {
      return { error: 'forbidden' as const, message: 'Accès refusé à cette analyse.' };
    }

    const { advanceJobOnce } = await import('./engine.server');
    const job = await advanceJobOnce(jobId);
    if (!job) return { error: 'not_found' as const, message: 'Analyse introuvable.' };
    return { job: toState(job) };
  });



export const saveCompetitorMatrixLead = createServerFn({ method: 'POST' })
  .inputValidator((input: { jobId: string; email: string; consent: boolean }) => input)
  .handler(async ({ data }) => {
    const { hashIp, clientIp, isAdminRequest, MATRIX_EMAIL_RE } = await import('./matrixRequest.server');
    const email = String(data.email || '').trim().toLowerCase();
    if (!MATRIX_EMAIL_RE.test(email) || email.length > 160) {
      return { error: 'invalid_email' as const, message: 'Adresse email invalide' };
    }
    if (!data.consent) return { error: 'consent_required' as const, message: 'Consentement requis' };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id, domain, share_token, ip_hash')
      .eq('id', String(data.jobId))
      .maybeSingle();
    if (!job) return { error: 'not_found' as const, message: 'Analyse introuvable.' };
    if (job.ip_hash !== (await hashIp(clientIp())) && !(await isAdminRequest())) {
      return { error: 'forbidden' as const, message: 'Accès refusé à cette analyse.' };
    }


    await supabaseAdmin.from('competitor_matrix_leads').insert({
      job_id: job.id,
      email,
      domain: job.domain,
      consent: true,
      ip_hash: await hashIp(clientIp()),
    });
    await supabaseAdmin.from('competitor_matrix_jobs').update({ email }).eq('id', job.id);

    return { ok: true, shareToken: job.share_token };
  });

export const getCompetitorMatrixByToken = createServerFn({ method: 'GET' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { toState } = await import('./matrixRequest.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('share_token', String(data.token).slice(0, 64))
      .maybeSingle();
    if (!job) return { error: 'not_found' as const };
    return { job: toState(job) };
  });
