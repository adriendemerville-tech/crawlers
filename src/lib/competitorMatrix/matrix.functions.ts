// Outil gratuit « Matrice Concurrence » — orchestration par étapes courtes.
// Le client appelle `advanceCompetitorMatrix` en boucle : chaque appel exécute
// UNE étape et rend la main, ce qui garde chaque requête sous la limite de temps
// du worker (pas de `EdgeRuntime.waitUntil` disponible ici).
// Toute la logique de quota et d'accès est serveur.

import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { buildMatrix } from './build';
import {
  AI_MEASURED_KEYWORDS,
  type AiReadingJson, type Competitor, type Identity,
  type MarketKeyword, type MatrixJobState, type MatrixStep, type SerpReadingJson,
} from './types';

export const MATRIX_FREE_QUOTA = 1; // 1 matrice par IP et par jour

function clientIp(): string {
  const fwd = getRequestHeader('x-forwarded-for') || '';
  return (
    fwd.split(',')[0]?.trim() ||
    getRequestHeader('cf-connecting-ip') ||
    getRequestHeader('x-real-ip') ||
    'unknown'
  );
}

async function hashIp(ip: string): Promise<string> {
  const pepper = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'matrice').slice(0, 24);
  const bytes = new TextEncoder().encode(`competitor-matrix:${pepper}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeUrl(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Vrai si la requête porte un token d'un utilisateur ayant le rôle admin. */
async function isAdminRequest(): Promise<boolean> {
  try {
    const auth = getRequestHeader('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return false;
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: data.user.id,
      _role: 'admin',
    });
    return isAdmin === true;
  } catch {
    return false;
  }
}


function toState(row: any): MatrixJobState {
  return {
    id: row.id,
    status: row.status,
    step: row.step || 'pending',
    progress: row.progress || 0,
    domain: row.domain,
    targetUrl: row.target_url,
    identity: row.identity ?? null,
    competitors: row.competitors ?? [],
    keywords: row.keywords ?? [],
    matrix: row.matrix ?? null,
    error: row.error ?? null,
    shareToken: row.share_token,
  };
}

export const getCompetitorMatrixQuota = createServerFn({ method: 'GET' }).handler(async () => {
  if (await isAdminRequest()) {
    return { quota: Infinity, used: 0, remaining: Infinity, unlimited: true as const };
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
    const targetUrl = normalizeUrl(data.url);
    if (!targetUrl) return { error: 'invalid_url' as const, message: 'URL invalide' };

    const { cleanDomain } = await import('./dfs.server');
    const domain = cleanDomain(new URL(targetUrl).hostname);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ipHash = await hashIp(clientIp());

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    if ((count ?? 0) >= MATRIX_FREE_QUOTA) {
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
 * Le client rappelle tant que `status === 'running'`.
 */
export const advanceCompetitorMatrix = createServerFn({ method: 'POST' })
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('id', String(data.jobId))
      .maybeSingle();

    if (!job) return { error: 'not_found' as const, message: 'Analyse introuvable.' };
    if (job.status !== 'running') return { job: toState(job) };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    try {
      switch (job.step as MatrixStep) {
        case 'identity': {
          const { resolveIdentity } = await import('./identity.server');
          patch.identity = await resolveIdentity(job.target_url, job.domain);
          patch.step = 'competitors';
          patch.progress = 20;
          break;
        }
        case 'competitors': {
          const { fetchVisibilityCompetitors, proposeCompetitorsWithLlm, mergeCompetitors } =
            await import('./competitors.server');
          const identity = job.identity as unknown as Identity;
          const existing = (job.competitors ?? []) as unknown as Competitor[];
          const userDomains = existing.filter((c) => c.source === 'user').map((c) => c.domain);
          const [visibility, proposed] = await Promise.all([
            fetchVisibilityCompetitors(job.domain),
            proposeCompetitorsWithLlm(identity),
          ]);
          const { matrix, outOfScope } = mergeCompetitors(userDomains, proposed, visibility, job.domain);
          patch.competitors = matrix;
          patch.out_of_scope = outOfScope;
          patch.step = 'keywords';
          patch.progress = 40;
          break;
        }
        case 'keywords': {
          const { selectMarketKeywords } = await import('./keywords.server');
          const competitors = (job.competitors ?? []) as unknown as Competitor[];
          patch.keywords = await selectMarketKeywords(
            job.identity as unknown as Identity,
            competitors.map((c) => c.domain),
          );
          patch.step = 'serp';
          patch.progress = 55;
          break;
        }
        case 'serp': {
          const { readSerp } = await import('./serp.server');
          const competitors = (job.competitors ?? []) as unknown as Competitor[];
          const keywords = (job.keywords ?? []) as unknown as MarketKeyword[];
          patch.serp = await readSerp(
            keywords.map((k) => k.keyword),
            [job.domain, ...competitors.map((c) => c.domain)],
          );
          patch.ai_overviews = (patch.serp as SerpReadingJson[]).map((s) => s.aiOverview);
          patch.step = 'ai';
          patch.progress = 70;
          break;
        }
        case 'ai': {
          // Un appel = un mot-clé × UN moteur (3 itérations). Mesurer les deux
          // moteurs dans le même appel dépassait la limite de temps du worker
          // et laissait le job bloqué en « running ».
          const { measureKeywordForModel } = await import('./aiCitations.server');
          const { AI_MODELS } = await import('./ai.server');
          const competitors = (job.competitors ?? []) as unknown as Competitor[];
          const keywords = (job.keywords ?? []) as unknown as MarketKeyword[];
          const domains = [job.domain, ...competitors.map((c) => c.domain)];
          const targets = keywords.slice(0, AI_MEASURED_KEYWORDS);
          const done = (job.ai_citations ?? []) as unknown as AiReadingJson[];

          const modelNames = AI_MODELS.map((m) => m.model);
          const last = done[done.length - 1];
          const lastIncomplete = last && (last.modelsDone ?? []).length < modelNames.length;
          const currentIndex = lastIncomplete ? done.length - 1 : done.length;
          const next = targets[currentIndex];

          if (next) {
            const previous = lastIncomplete ? last : undefined;
            const model = modelNames.find((m) => !(previous?.modelsDone ?? []).includes(m))!;
            const reading = await measureKeywordForModel(next.keyword, domains, model, previous);
            patch.ai_citations = lastIncomplete
              ? [...done.slice(0, -1), reading]
              : [...done, reading];
            const units = Math.max(1, targets.length * modelNames.length);
            const doneUnits = currentIndex * modelNames.length + (reading.modelsDone?.length ?? 1);
            patch.progress = 70 + Math.round((25 * doneUnits) / units);
            break;
          }


          const result = buildMatrix(
            job.identity as unknown as Identity,
            competitors,
            (job.out_of_scope ?? []) as unknown as Competitor[],
            keywords,
            (job.serp ?? []) as unknown as SerpReadingJson[],
            done,
          );
          patch.matrix = result;
          patch.summary = result.summary;
          patch.status = 'done';
          patch.step = 'done';
          patch.progress = 100;
          break;
        }
        default:
          patch.status = 'done';
          patch.step = 'done';
          patch.progress = 100;
      }
    } catch (e) {
      console.error('[competitor-matrix] step failed', job.step, e instanceof Error ? e.message : e);
      patch.status = 'error';
      patch.error = 'Une étape de l’analyse a échoué. Réessayez dans quelques minutes.';
    }

    const { data: updated } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .update(patch as never)
      .eq('id', job.id)
      .select('*')
      .single();

    return { job: toState(updated ?? { ...job, ...patch }) };
  });

export const saveCompetitorMatrixLead = createServerFn({ method: 'POST' })
  .inputValidator((input: { jobId: string; email: string; consent: boolean }) => input)
  .handler(async ({ data }) => {
    const email = String(data.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 160) {
      return { error: 'invalid_email' as const, message: 'Adresse email invalide' };
    }
    if (!data.consent) return { error: 'consent_required' as const, message: 'Consentement requis' };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('id, domain, share_token')
      .eq('id', String(data.jobId))
      .maybeSingle();
    if (!job) return { error: 'not_found' as const, message: 'Analyse introuvable.' };

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
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: job } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('share_token', String(data.token).slice(0, 64))
      .maybeSingle();
    if (!job) return { error: 'not_found' as const };
    return { job: toState(job) };
  });
