// Moteur d'avancement de la matrice de concurrence (serveur uniquement).
// Une étape par appel : chaque requête reste sous la limite de temps du worker.
// Le cron (`/api/public/hooks/competitor-matrix-tick`) enchaîne les étapes en
// arrière-plan, protégé par le bail `lock_until` pour éviter le double travail.

import { buildMatrix } from './build';
import {
  AI_MEASURED_KEYWORDS,
  type AiReadingJson, type Competitor, type Identity, type MarketKeyword,
  type MatrixStep, type SeedSerpReading, type SerpReadingJson,
} from './types';

type Job = Record<string, unknown> & { id: string; step: string; status: string; domain: string; target_url: string };

/** Exécute UNE étape et renvoie le patch à écrire. */
export async function runMatrixStep(job: Job): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  try {
    switch (job.step as MatrixStep) {
      case 'identity': {
        const { resolveIdentity } = await import('./identity.server');
        patch.identity = await resolveIdentity(job.target_url, job.domain);
        patch.step = 'seed_keywords';
        patch.progress = 15;
        break;
      }
      // Amorçage : les mots-clés de la cible et des IA servent de sonde de marché.
      case 'seed_keywords': {
        const { buildSeedKeywordPool } = await import('./keywords.server');
        patch.keywords = await buildSeedKeywordPool(job.identity as unknown as Identity);
        patch.step = 'seed_serp';
        patch.progress = 25;
        break;
      }
      // Passe 1 : on lit la SERP AVANT d'arrêter la liste des concurrents,
      // sinon aucun leader des positions 1-5 ne peut entrer dans la matrice.
      case 'seed_serp': {
        const { seedSerp } = await import('./serp.server');
        const seedPool = ((job.keywords ?? []) as unknown as MarketKeyword[]);
        patch.seed_serp = await seedSerp(seedPool.map((k) => k.keyword), job.domain);
        patch.step = 'competitors';
        patch.progress = 35;
        break;
      }
      case 'competitors': {
        const {
          fetchVisibilityCompetitors,
          proposeCompetitorsWithLlm,
          fetchComparisonCompetitors,
          mergeCompetitors,
        } = await import('./competitors.server');
        const { detectLeaders, detectQuickWins, seedSerpDomains } = await import('./leaders.server');
        const identity = job.identity as unknown as Identity;
        const existing = (job.competitors ?? []) as unknown as Competitor[];
        const userDomains = existing.filter((c) => c.source === 'user').map((c) => c.domain);
        const seed = (job.seed_serp ?? []) as unknown as SeedSerpReading[];
        const leaders = detectLeaders(seed, job.domain);
        const [visibility, proposed, comparatifs] = await Promise.all([
          fetchVisibilityCompetitors(job.domain),
          proposeCompetitorsWithLlm(identity),
          // Pages « X vs Y » / « alternatives » : n'apporte quelque chose que
          // pour les SaaS, la fonction retourne [] sinon.
          fetchComparisonCompetitors(identity),
        ]);
        proposed.push(...comparatifs);
        const { matrix, outOfScope } = mergeCompetitors(
          userDomains, proposed, visibility, job.domain, leaders, seedSerpDomains(seed),
        );
        patch.competitors = matrix;
        patch.out_of_scope = outOfScope;
        patch.quick_wins = detectQuickWins(seed, leaders.map((l) => l.domain));
        patch.step = 'keywords';
        patch.progress = 45;
        break;
      }
      case 'keywords': {
        const { expandMarketKeywords } = await import('./keywords.server');
        const competitors = (job.competitors ?? []) as unknown as Competitor[];
        const seedPool = (job.keywords ?? []) as unknown as MarketKeyword[];
        // Les leaders passent d'abord : ce sont eux qui définissent le marché.
        const ordered = [...competitors].sort(
          (a, b) => (a.type === 'leader' ? 0 : 1) - (b.type === 'leader' ? 0 : 1),
        );
        patch.keywords = await expandMarketKeywords(
          seedPool,
          ordered.map((c) => c.domain),
          (job.quick_wins ?? []) as unknown as string[],
          job.identity as unknown as Identity,
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
        patch.step = 'authority';
        patch.progress = 62;
        break;
      }
      // Profil de liens + signaux E-E-A-T : ce qui plafonne la faisabilité des
      // positions, donc calculé avant le plan en phases du rapport.
      case 'authority': {
        const { readAuthority } = await import('./authority.server');
        const competitors = (job.competitors ?? []) as unknown as Competitor[];
        try {
          patch.authority = await readAuthority(job.target_url, job.domain, competitors);
        } catch (e) {
          // Une mesure d'autorité manquante n'invalide pas l'analyse : le rapport
          // exclut alors ces signaux au lieu de les compter comme des échecs.
          console.error('[competitor-matrix] authority step degraded', e instanceof Error ? e.message : e);
          patch.authority = null;
        }
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

  return patch;
}

const LEASE_MS = 3 * 60 * 1000;
const BUDGET_MS = 45_000;
const MAX_ATTEMPTS = 12;

/**
 * Prise de bail atomique sur un job : l'UPDATE conditionnel ne peut réussir que
 * pour un seul appelant, ce qui empêche le cron et l'onglet client d'exécuter la
 * même étape deux fois (donc de facturer deux fois les appels LLM / DataForSEO).
 * Renvoie la ligne verrouillée, ou null si un autre traitement la détient.
 */
async function claimJob(jobId: string): Promise<Job | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const nowIso = new Date().toISOString();
  const lease = new Date(Date.now() + LEASE_MS).toISOString();

  const { data: claimed } = await supabaseAdmin
    .from('competitor_matrix_jobs')
    .update({ lock_until: lease } as never)
    .eq('id', jobId)
    .eq('status', 'running')
    .or(`lock_until.is.null,lock_until.lt.${nowIso}`)
    .select('*')
    .maybeSingle();

  return (claimed as Job | null) ?? null;
}

async function releaseJob(jobId: string, patch: Record<string, unknown>): Promise<Job | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: updated } = await supabaseAdmin
    .from('competitor_matrix_jobs')
    .update({ ...patch, lock_until: null } as never)
    .eq('id', jobId)
    .select('*')
    .maybeSingle();
  return (updated as Job | null) ?? null;
}

/**
 * Charge le job, prend le verrou, exécute UNE étape, écrit le résultat et libère.
 * Si le job est déjà verrouillé (cron en cours), on renvoie son état courant sans
 * refaire l'étape : l'appel est idempotent côté coût.
 */
export async function advanceJobOnce(jobId: string, opts?: { alreadyLeased?: boolean }): Promise<Job | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  if (opts?.alreadyLeased) {
    const { data: leased } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (!leased) return null;
    if ((leased as Job).status !== 'running') return leased as Job;
    const patch = await runMatrixStep(leased as Job);
    const { data: updated } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .update(patch as never)
      .eq('id', jobId)
      .select('*')
      .maybeSingle();
    return (updated ?? { ...(leased as Job), ...patch }) as Job;
  }

  const claimed = await claimJob(jobId);
  if (!claimed) {
    // Soit le job n'est plus « running », soit un autre traitement le détient :
    // on rend l'état lu, jamais une seconde exécution de l'étape.
    const { data: current } = await supabaseAdmin
      .from('competitor_matrix_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    return (current as Job | null) ?? null;
  }

  const attempts = Number((claimed as Record<string, unknown>)['attempts'] ?? 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    return await releaseJob(jobId, {
      attempts,
      status: 'error',
      error: 'Analyse interrompue après trop de tentatives. Relancez une nouvelle matrice.',
      updated_at: new Date().toISOString(),
    });
  }

  const patch = await runMatrixStep(claimed);
  const updated = await releaseJob(jobId, { ...patch, attempts });
  return (updated ?? ({ ...claimed, ...patch } as Job));
}

/**
 * Fait avancer les analyses en cours sans navigateur ouvert.
 * Le verrou est pris par `advanceJobOnce` lui-même : le cron ne fait que
 * sélectionner les candidats inactifs et boucler dans son budget de temps.
 */
export async function advanceRunningMatrices(maxJobs = 2) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const now = new Date();
  const { data: candidates } = await supabaseAdmin
    .from('competitor_matrix_jobs')
    .select('id, lock_until, attempts')
    .eq('status', 'running')
    // Les jobs pilotés depuis un onglet ouvert se mettent à jour en continu :
    // on ne reprend que ceux inactifs depuis plus de 45 s, sans double travail.
    .lt('updated_at', new Date(now.getTime() - 45_000).toISOString())
    .or(`lock_until.is.null,lock_until.lt.${now.toISOString()}`)
    .order('updated_at', { ascending: true })
    .limit(maxJobs);

  const results: { jobId: string; steps: number; status: string }[] = [];
  const startedAt = Date.now();

  for (const candidate of candidates ?? []) {
    let steps = 0;
    let status = 'running';
    while (Date.now() - startedAt < BUDGET_MS) {
      const job = await advanceJobOnce(candidate.id);
      steps += 1;
      status = job?.status ?? 'error';
      if (status !== 'running') break;
      // Le verrou a été refusé (autre traitement en cours) : on ne boucle pas.
      if (!job) break;
    }
    results.push({ jobId: candidate.id, steps, status });
    if (Date.now() - startedAt >= BUDGET_MS) break;
  }

  return results;
}

