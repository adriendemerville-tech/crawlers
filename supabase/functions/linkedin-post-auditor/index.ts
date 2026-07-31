// linkedin-post-auditor — 2e boucle d'automatisation LinkedIn.
//
// Rôle : ~5 min après publication, relire le post RÉELLEMENT publié sur LinkedIn,
// le confronter aux règles de création (hook, longueur 1000-1500, mention @crawlers.fr,
// zéro emoji, structure lisible = potentiel d'impressions), et le corriger via
// PARTIAL_UPDATE si le score est insuffisant.
//
// Économie de tokens : audit déterministe d'abord (gratuit). Un seul appel LLM,
// et uniquement si le score déterministe est sous le seuil (ou hook faible).
//
// Auth : admin OU cron (header x-cron-secret = LINKEDIN_CRON_SECRET).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callOpenRouterJson } from '../_shared/openRouterAI.ts';
import { scoreCaption, EMOJI_RE } from '../_shared/linkedinCompliance.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LINKEDIN_API_KEY = Deno.env.get('LINKEDIN_API_KEY');
const CRON_SECRET = Deno.env.get('LINKEDIN_CRON_SECRET');
const LINKEDIN_GATEWAY = 'https://connector-gateway.lovable.dev/linkedin';

const TEXT_MODEL = 'mistralai/mistral-large-2512';
const DELAY_MINUTES = 5;
// Seuil d'entrée : en dessous, on déclenche la boucle de correction.
const SCORE_THRESHOLD = 75;
// Cible : score à partir duquel on arrête d'itérer (post considéré conforme).
const TARGET_SCORE = 90;
// Gain minimum d'une itération pour justifier un nouvel appel LLM.
const MIN_GAIN = 3;
// Itérations LLM max par exécution, et budget cumulé par post.
const MAX_ITERATIONS_PER_RUN = 3;
const MAX_FIX_ATTEMPTS = 5;


function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function liHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': LINKEDIN_API_KEY!,
    'LinkedIn-Version': '202510',
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

// Little Text Format : caractères réservés à échapper pour /rest/posts.
function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
}
function unescapeLittleText(text: string): string {
  return text.replace(/\\([\\|{}@\[\]()<>#*_~])/g, '$1');
}


/** Audit déterministe partagé avec le générateur (même barème pondéré). */
const auditText = scoreCaption;

async function fetchPublishedText(urn: string): Promise<string | null> {
  try {
    const res = await fetch(`${LINKEDIN_GATEWAY}/rest/posts/${encodeURIComponent(urn)}`, {
      headers: liHeaders(),
    });
    if (!res.ok) {
      console.warn('rest/posts GET failed', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const j = await res.json();
    const c = j?.commentary;
    return typeof c === 'string' ? unescapeLittleText(c) : null;
  } catch (e) {
    console.warn('fetchPublishedText error', e);
    return null;
  }
}

/** Engagement disponible pour un post membre : likes / commentaires / partages. */
async function fetchEngagement(urn: string) {
  try {
    const res = await fetch(`${LINKEDIN_GATEWAY}/v2/socialActions/${encodeURIComponent(urn)}`, {
      headers: liHeaders(),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      likes: j?.likesSummary?.totalLikes ?? j?.likeSummary?.totalLikes ?? 0,
      comments: j?.commentsSummary?.aggregatedTotalComments ?? j?.commentSummary?.totalFirstLevelComments ?? 0,
    };
  } catch { return null; }
}

async function patchCommentary(urn: string, fullText: string) {
  const res = await fetch(`${LINKEDIN_GATEWAY}/rest/posts/${encodeURIComponent(urn)}`, {
    method: 'POST',
    headers: liHeaders({ 'Content-Type': 'application/json', 'X-RestLi-Method': 'PARTIAL_UPDATE' }),
    body: JSON.stringify({ patch: { $set: { commentary: escapeLittleText(fullText) } } }),
  });
  if (!res.ok) {
    const details = (await res.text()).slice(0, 500);
    throw new Error(`PARTIAL_UPDATE ${res.status}: ${details}`);
  }
  await res.text();
}

const SYSTEM = `Tu es éditeur LinkedIn senior pour Crawlers (SEO/GEO, B2B français).
Tu corriges un post DÉJÀ PUBLIÉ pour maximiser sa portée sans en changer le fond.

Règles impératives du post final :
- Entre 1000 et 1500 caractères hashtags exclus.
- Contient au moins une fois "@crawlers.fr" en langue naturelle.
- Aucun emoji, aucun tiret cadratin (— ou –).
- Première ligne = hook de 40 à 140 signes, autoportant, avec une tension ou un chiffre concret, lisible avant le "voir plus" de LinkedIn.
- Paragraphes courts (max 3 lignes), sauts de ligne, une idée par bloc.
- Termine par un CTA simple (question ou invitation à tester).
- Français naturel, pas de jargon marketing creux, pas de superlatifs vides.

Tu ne réécris QUE ce qui est nécessaire pour corriger les manquements listés : garde le fond, les faits, les chiffres et les liens du post d'origine.
Réponds en JSON strict : {"needs_fix": boolean, "hook_score": 0-100, "fixed_text": "texte complet corrigé sans hashtags", "reasons": ["..."]}`;

async function runAudit(admin: ReturnType<typeof createClient>, post: any, dryRun: boolean) {
  const urn = String(post.linkedin_post_urn);
  const hashtags: string[] = Array.isArray(post.hashtags) ? post.hashtags : [];

  const remote = await fetchPublishedText(urn);
  const stored = String(post.edited_text ?? post.generated_text ?? '');
  const liveFull = (remote ?? (hashtags.length ? `${stored}\n\n${hashtags.join(' ')}` : stored)).trim();
  const liveBody = liveFull.replace(/\n*(#[\p{L}\p{N}_]+\s*)+$/u, '').trim();

  const det = auditText(liveFull);
  const engagement = await fetchEngagement(urn);

  const report: Record<string, unknown> = {
    audited_at: new Date().toISOString(),
    source: remote ? 'linkedin' : 'db_fallback',
    deterministic_score: det.score,
    length: det.length,
    hook: det.hook,
    failed_checks: det.failed.map((c) => ({ id: c.id, detail: c.detail })),
    engagement,
  };

  const needsLlm = det.score < SCORE_THRESHOLD || !det.hookStrong;
  if (!needsLlm) {
    report.action = 'none';
    await admin.from('linkedin_scheduled_posts')
      .update({ audit_status: 'passed', audit_score: det.score, audit_report: report, audited_at: new Date().toISOString() })
      .eq('id', post.id);
    return { post_id: post.id, urn, score: det.score, action: 'none', report };
  }

  const attempts = Number(post.audit_attempts ?? 0);
  if (attempts >= MAX_FIX_ATTEMPTS) {
    report.action = 'skipped_max_attempts';
    await admin.from('linkedin_scheduled_posts')
      .update({ audit_status: 'needs_review', audit_score: det.score, audit_report: report, audited_at: new Date().toISOString() })
      .eq('id', post.id);
    return { post_id: post.id, urn, score: det.score, action: 'skipped_max_attempts', report };
  }

  // ── Boucle d'amélioration itérative ──
  // On itère tant que le score < TARGET_SCORE, que le gain reste significatif
  // et que le budget d'itérations n'est pas épuisé. Un seul PATCH LinkedIn à la fin.
  const budget = Math.min(MAX_ITERATIONS_PER_RUN, MAX_FIX_ATTEMPTS - attempts);
  let bestText = liveBody;
  let bestScore = det.score;
  let bestChecks = det;
  const iterations: Array<Record<string, unknown>> = [];
  let stopReason = 'budget_exhausted';
  let llmCalls = 0;

  for (let i = 0; i < budget; i++) {
    const userPrompt = [
      `Itération ${i + 1}/${budget}. Score actuel : ${bestScore}/100 (cible ${TARGET_SCORE}).`,
      `Manquements détectés : ${bestChecks.failed.map((c) => c.detail).join(' | ') || 'hook faible'}`,
      engagement ? `Engagement à ${DELAY_MINUTES} min : ${engagement.likes} likes, ${engagement.comments} commentaires.` : '',
      '',
      'Post à corriger :',
      '"""',
      bestText,
      '"""',
    ].filter(Boolean).join('\n');

    let parsed: { needs_fix?: boolean; hook_score?: number; fixed_text?: string; reasons?: string[] };
    try {
      const res = await callOpenRouterJson<typeof parsed>({
        model: TEXT_MODEL,
        system: SYSTEM,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 1200,
      });
      parsed = res.parsed;
      llmCalls++;
    } catch (e) {
      stopReason = 'llm_failed';
      iterations.push({ iteration: i + 1, error: String((e as Error).message ?? e) });
      break;
    }

    // Couche déterministe partagée avant toute évaluation du candidat.
    const enforced = enforceCaptionCompliance(String(parsed?.fixed_text ?? ''), { hashtags });
    const candidate = enforced.body;
    const after = auditText(enforced.fullText);
    const valid = !!candidate && !enforced.tooShort && after.length <= 1500;

    const gain = after.score - bestScore;

    iterations.push({
      iteration: i + 1,
      candidate_score: after.score,
      gain,
      valid,
      hook_score: parsed?.hook_score ?? null,
      reasons: parsed?.reasons ?? [],
      failed_checks: after.failed.map((c) => c.id),
    });

    if (!valid || gain < MIN_GAIN) {
      stopReason = !valid ? 'invalid_candidate' : 'plateau';
      break;
    }

    bestText = candidate;
    bestScore = after.score;
    bestChecks = after;

    if (bestScore >= TARGET_SCORE && after.hookStrong) {
      stopReason = 'target_reached';
      break;
    }
  }

  report.iterations = iterations;
  report.llm_calls = llmCalls;
  report.stop_reason = stopReason;
  report.target_score = TARGET_SCORE;

  const improved = bestScore > det.score && bestText !== liveBody;

  if (!improved) {
    report.action = 'rejected_fix';
    report.candidate_score = bestScore;
    await admin.from('linkedin_scheduled_posts')
      .update({
        audit_status: 'needs_review',
        audit_score: det.score,
        audit_report: report,
        audited_at: new Date().toISOString(),
        audit_attempts: attempts + Math.max(1, llmCalls),
      })
      .eq('id', post.id);
    return { post_id: post.id, urn, score: det.score, action: 'rejected_fix', report };
  }

  if (dryRun) {
    report.action = 'dry_run';
    report.candidate_score = bestScore;
    report.candidate_text = bestText;
    return { post_id: post.id, urn, score: det.score, action: 'dry_run', report };
  }

  const fullFixed = hashtags.length ? `${bestText}\n\n${hashtags.join(' ')}` : bestText;
  await patchCommentary(urn, fullFixed);

  report.action = 'patched';
  report.new_score = bestScore;
  await admin.from('linkedin_scheduled_posts')
    .update({
      edited_text: bestText,
      // 'patched' = cible atteinte, 'needs_review' = amélioré mais encore sous la cible
      audit_status: bestScore >= TARGET_SCORE ? 'patched' : 'needs_review',
      audit_score: bestScore,
      audit_report: report,
      audited_at: new Date().toISOString(),
      audit_attempts: attempts + llmCalls,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id);

  return { post_id: post.id, urn, score: bestScore, previous_score: det.score, action: 'patched', report };
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !LINKEDIN_API_KEY) {
      return json({ error: 'LinkedIn connector missing (LOVABLE_API_KEY / LINKEDIN_API_KEY)' }, 500);
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;
    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
      if (!isAdmin) return json({ error: 'Admin only' }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const postId: string | undefined = body?.post_id;
    const dryRun: boolean = body?.dry_run === true;
    const force: boolean = body?.force === true;

    let query = admin
      .from('linkedin_scheduled_posts')
      .select('*')
      .eq('status', 'published')
      .not('linkedin_post_urn', 'is', null);

    if (postId) {
      query = query.eq('id', postId);
    } else {
      const cutoff = new Date(Date.now() - DELAY_MINUTES * 60_000).toISOString();
      query = query
        .lte('published_at', cutoff)
        .gte('published_at', new Date(Date.now() - 24 * 3600_000).toISOString())
        .order('published_at', { ascending: true })
        .limit(3);
      // Jamais audité, OU audité mais encore sous la cible avec du budget restant :
      // le cron relance alors un cycle d'amélioration.
      if (!force) {
        query = query.or(
          `audited_at.is.null,and(audit_score.lt.${TARGET_SCORE},audit_attempts.lt.${MAX_FIX_ATTEMPTS})`,
        );
      }

    }

    const { data: posts, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!posts?.length) return json({ skipped: true, reason: 'aucun post à auditer' });

    const results = [];
    for (const post of posts) {
      try {
        results.push(await runAudit(admin, post, dryRun));
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        console.error('audit failed', post.id, msg);
        await admin.from('linkedin_scheduled_posts')
          .update({ audit_status: 'failed', audit_report: { error: msg }, audited_at: new Date().toISOString() })
          .eq('id', post.id);
        results.push({ post_id: post.id, action: 'error', error: msg });
      }
    }

    return json({ success: true, audited: results.length, results });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    console.error('linkedin-post-auditor error', msg);
    return json({ error: msg }, 500);
  }
});
