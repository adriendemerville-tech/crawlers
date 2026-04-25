/**
 * copilot-orchestrator — Sprint P1 : agent loop + skills + persistence + approval/reject.
 *
 * POST /copilot-orchestrator
 *   body : {
 *     persona: 'felix' | 'strategist',
 *     session_id?: string,
 *     message?: string,
 *     context?: object,
 *     approve_action_id?: string,   // ré-exécute une action awaiting_approval
 *     reject_action_id?: string,    // P1 #6 : marque rejected + notifie LLM
 *     reject_reason?: string,
 *   }
 *   res  : { session_id, reply, actions, persona, awaiting_approvals, iterations }
 *
 * Boucle :
 *   1. Charge l'historique de la session (incl. tool_calls/results — P0 #1).
 *   2. Appelle Lovable AI Gateway avec system prompt + tools de la persona.
 *   3. Si tool_calls → résout chaque skill via la policy (auto / approval / forbidden).
 *      - auto : exécute, log dans copilot_actions(success|error), réinjecte le résultat.
 *      - approval : crée copilot_actions(awaiting_approval), arrête le batch (P0 #2).
 *      - forbidden : log rejected, réinjecte erreur "non autorisé" (P1 #5 inviolable).
 *   4. Re-prompt jusqu'à `finish_reason=stop` ou max 6 itérations.
 *
 * P1 features :
 *   #4 creator_mode persisté dans session.context.creator_mode
 *   #5 FORBIDDEN_EVEN_IN_CREATOR — whitelist des skills inviolables
 *   #6 reject_action_id — rejet explicite avec tool_result synthétique pour le LLM
 *   #7 handleApproval re-prompt le LLM après exécution → réponse contextuelle
 *   #8 vérif persona stricte sur approval/reject
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import {
  getPersonaConfig,
  resolveSkillPolicy,
  type PersonaConfig,
} from './personas.ts';
import { getSkill, buildToolDefinitions, listSkills, type SkillContext } from './skills/registry.ts';
import {
  categorizeAction,
  summarizeForHistory,
  withTimeout,
  withAbortableTimeout,
  LLM_TIMEOUT_MS,
  SKILL_TIMEOUT_MS,
} from './helpers.ts';

interface OrchestratorBody {
  persona: string;
  session_id?: string;
  message?: string;
  context?: Record<string, unknown>;
  approve_action_id?: string;
  reject_action_id?: string;
  reject_reason?: string;
  /** P2 fix B7 — libère immédiatement le verrou processing d'une session sans renvoyer de message. */
  close_session?: boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

const MAX_ITERATIONS = 6;
const HISTORY_LIMIT = 20;

// P1 #5 — Skills INVIOLABLES même en mode créateur.
// Toute skill listée ici reste forbidden quoi qu'il arrive (sécurité par design,
// pas juste permission). Ajouter ici toute skill destructrice/irréversible
// qui ne devrait jamais être contournée par /creator: ou /admin:.
const FORBIDDEN_EVEN_IN_CREATOR: ReadonlySet<string> = new Set([
  'delete_site',
  'delete_user',
  'rotate_keys',
  'escalate_to_human',
  'mass_delete',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
  // Tracké hors-try pour pouvoir libérer le statut 'processing' en cas de crash.
  let sessionIdForCleanup: string | null = null;
  let serviceForCleanup: ReturnType<typeof getServiceClient> | null = null;

  try {
    // ── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonError('Non authentifié', 401);

    const userClient = getUserClient(authHeader);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return jsonError('Token invalide', 401);
    const userId = claims.claims.sub as string;

    // ── Body ──────────────────────────────────────────────
    const body = (await req.json()) as OrchestratorBody;
    if (!body.persona) return jsonError('persona requis', 400);

    const persona = getPersonaConfig(body.persona);
    if (!persona) return jsonError(`Persona inconnu : ${body.persona}`, 400);

    const service = getServiceClient();
    serviceForCleanup = service;

    // ── Cas close_session : libère le verrou processing sans appel LLM (P2 fix B7) ──
    // Appelé par useCopilot.reset() côté front pour ne pas laisser une session figée
    // en 'processing' jusqu'à la reconciliation 90s.
    if (body.close_session && body.session_id) {
      const { error: closeErr } = await service
        .from('copilot_sessions')
        .update({ status: 'active', processing_started_at: null })
        .eq('id', body.session_id)
        .eq('user_id', userId)
        .eq('persona', persona.id);
      if (closeErr) return jsonError(`Fermeture session : ${closeErr.message}`, 500);
      return new Response(
        JSON.stringify({ session_id: body.session_id, closed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Cas approbation : ré-exécute + relance la boucle LLM (P1 #7) ──
    if (body.approve_action_id) {
      return await handleApproval({
        actionId: body.approve_action_id,
        userId,
        userClient,
        service,
        persona,
      });
    }

    // ── Cas rejet : marque rejected + notifie LLM (P1 #6) ──
    if (body.reject_action_id) {
      return await handleRejection({
        actionId: body.reject_action_id,
        reason: body.reject_reason,
        userId,
        userClient,
        service,
        persona,
      });
    }

    if (!body.message) return jsonError('message requis', 400);

    // ── Préfixe admin /creator: /createur: /admin: ────────
    // P1 #4 — creator_mode est persisté dans session.context.creator_mode
    // pour survivre entre deux requêtes HTTP de la même conversation.
    let userMessage = body.message;
    let isCreatorMode = false;
    const creatorPrefixMatch = userMessage.match(/^\s*\/(?:createur|creator|admin)\s*:\s*/i);
    if (creatorPrefixMatch) {
      const { data: isAdmin } = await service.rpc('has_role', { _user_id: userId, _role: 'admin' });
      if (isAdmin === true) {
        isCreatorMode = true;
        userMessage = userMessage.slice(creatorPrefixMatch[0].length).trim();
      }
      // Si non-admin : on laisse le message tel quel, le préfixe est ignoré silencieusement
    }

    // ── Session : create or load ─────────────────────────
    let sessionId: string;
    let sessionContext: Record<string, unknown> = {};

    if (!body.session_id) {
      // Nouvelle session : si creator_mode détecté on le grave dans le context
      const initialContext = {
        ...(body.context ?? {}),
        ...(isCreatorMode ? { creator_mode: true } : {}),
      };
      const { data: created, error: cErr } = await service
        .from('copilot_sessions')
        .insert({
          user_id: userId,
          persona: persona.id,
          context: initialContext,
          title: body.message.slice(0, 80),
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .select('id, context')
        .single();
      if (cErr || !created) return jsonError(`Création session : ${cErr?.message}`, 500);
      sessionId = created.id;
      sessionContext = (created.context as Record<string, unknown>) ?? {};
      sessionIdForCleanup = sessionId;
    } else {
      sessionId = body.session_id;
      sessionIdForCleanup = sessionId;

      // Reconciliation : si la session est en 'processing' depuis > 90s, on la débloque.
      // (Cas crash entre tool_calls et persist final → message fantôme à éviter.)
      // P1 #4/8 — on charge aussi context + persona pour vérifier la cohérence
      const { data: existingSess } = await service
        .from('copilot_sessions')
        .select('status, processing_started_at, context, persona')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingSess) return jsonError('Session introuvable', 404);
      // P1 #8 — la persona du body doit matcher celle figée à la création
      if (existingSess.persona !== persona.id) {
        return jsonError(
          `Persona incohérent : la session a été créée avec '${existingSess.persona}', tu envoies '${persona.id}'.`,
          400,
        );
      }

      sessionContext = (existingSess.context as Record<string, unknown>) ?? {};

      if (existingSess.status === 'processing' && existingSess.processing_started_at) {
        const elapsedMs = Date.now() - new Date(existingSess.processing_started_at).getTime();
        if (elapsedMs < 90_000) {
          return jsonError('Une réponse est déjà en cours de génération pour cette session. Patiente quelques secondes.', 409);
        }
        // > 90s : crash silencieux probable. On insère un message assistant "récupération"
        // pour ne pas laisser des actions orphelines sans contexte textuel.
        await service.from('copilot_actions').insert({
          session_id: sessionId, user_id: userId, persona: persona.id,
          skill: '_assistant_reply', input: {},
          output: { content: "_(Réponse précédente interrompue après un délai serveur. Je reprends ici — n'hésite pas à reformuler si nécessaire.)_" },
          status: 'success', duration_ms: 0,
          action_category: 'system',
        });
      }

      // P1 #4 — restore creator_mode depuis le context, ou l'active si nouveau préfixe admin valide
      if (sessionContext.creator_mode === true) {
        isCreatorMode = true;
      }
      if (isCreatorMode && sessionContext.creator_mode !== true) {
        // Première activation dans une session existante → on persiste
        sessionContext = { ...sessionContext, creator_mode: true };
      }

      await service
        .from('copilot_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          status: 'processing',
          processing_started_at: new Date().toISOString(),
          context: sessionContext,
        })
        .eq('id', sessionId)
        .eq('user_id', userId);
    }

    // ── Lance la boucle agent ────────────────────────────
    const loopResult = await runAgentLoop({
      persona,
      sessionId,
      userId,
      userMessage,
      runtimeContext: body.context,
      isCreatorMode,
      userClient,
      service,
      t0,
      // Première itération : message user à pousser explicitement
      initialUserMessage: { role: 'user', content: userMessage },
    });

    // Persiste le message utilisateur + réponse finale comme paire conversation
    await service.from('copilot_actions').insert([
      { session_id: sessionId, user_id: userId, persona: persona.id, skill: '_user_message', input: { content: body.message }, status: 'success', duration_ms: 0, action_category: 'system' },
      { session_id: sessionId, user_id: userId, persona: persona.id, skill: '_assistant_reply', input: {}, output: { content: loopResult.finalReply }, status: 'success', duration_ms: Date.now() - t0, action_category: 'system' },
    ]);

    // Libère le statut processing → active (succès nominal)
    await service.from('copilot_sessions')
      .update({ status: 'active', processing_started_at: null })
      .eq('id', sessionId).eq('user_id', userId);

    return jsonOk({
      session_id: sessionId,
      reply: loopResult.finalReply,
      actions: loopResult.executedActions,
      awaiting_approvals: loopResult.awaitingApprovals,
      persona: persona.id,
      iterations: loopResult.iterations,
      creator_mode: isCreatorMode,
    });
  } catch (e) {
    console.error('[copilot-orchestrator] Erreur:', e);
    return jsonError((e as Error).message, 500);
  } finally {
    // Garantit la libération du statut processing même en cas de crash
    if (sessionIdForCleanup && serviceForCleanup) {
      try {
        await serviceForCleanup.from('copilot_sessions')
          .update({ status: 'active', processing_started_at: null })
          .eq('id', sessionIdForCleanup)
          .eq('status', 'processing');
      } catch {
        // best-effort
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════
// runAgentLoop — boucle LLM extraite pour réutilisation
// (utilisée par le flux normal ET par handleApproval/handleRejection)
// ═══════════════════════════════════════════════════════════
interface AgentLoopResult {
  finalReply: string;
  executedActions: Array<{ skill: string; status: string; output?: unknown; error?: string; action_id?: string }>;
  awaitingApprovals: Array<{ action_id: string; skill: string; input: unknown }>;
  iterations: number;
}

async function runAgentLoop(args: {
  persona: PersonaConfig;
  sessionId: string;
  userId: string;
  userMessage: string;
  runtimeContext?: Record<string, unknown>;
  isCreatorMode: boolean;
  userClient: ReturnType<typeof getUserClient>;
  service: ReturnType<typeof getServiceClient>;
  t0: number;
  /** Message à pousser au début (user en flux normal, ou tool_result en post-approval) */
  initialUserMessage?: ChatMessage;
  /** Messages additionnels à pousser après l'historique (ex: paire tool_call+result post-approval) */
  primingMessages?: ChatMessage[];
}): Promise<AgentLoopResult> {
  const { persona, sessionId, userId, runtimeContext, isCreatorMode, userClient, service } = args;

  // ── Historique conversation ──────────────────────────
  const history = await loadHistory(service, sessionId, userId);

  // ── Construit messages pour LLM ──────────────────────
  const contextStr = runtimeContext && Object.keys(runtimeContext).length > 0
    ? `\n\nContexte courant :\n${JSON.stringify(runtimeContext, null, 2)}`
    : '';

  const creatorBanner = isCreatorMode
    ? `\n\n## MODE CRÉATEUR ACTIF\nL'administrateur créateur (rôle 'admin') t'a invoqué via le préfixe \`/creator :\` (ou \`/createur :\`, \`/admin :\`).\nCe mode est persistant pour toute la session.\nDans ce mode :\n- Toutes les skills disponibles sont débloquées et exécutables sans approbation préalable (auto), SAUF les skills inviolables (suppressions massives, rotation de clés, escalade humaine).\n- Les actions destructrices courantes (CMS publish/patch, déploiements) sont autorisées.\n- Tu peux consulter le backend, dispatcher des directives, et agir au nom du créateur.\n`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: persona.systemPrompt + creatorBanner + contextStr },
    ...history,
  ];
  if (args.primingMessages) messages.push(...args.primingMessages);
  if (args.initialUserMessage) messages.push(args.initialUserMessage);

  // ── Tools autorisés ──
  // En mode créateur : toutes les skills du registry sauf les inviolables (P1 #5).
  const allowedSkills = isCreatorMode
    ? Array.from(new Set([...Object.keys(persona.skillPolicies), ...listSkills()]))
        .filter((s) => !FORBIDDEN_EVEN_IN_CREATOR.has(s))
    : Object.keys(persona.skillPolicies).filter(
        (s) => persona.skillPolicies[s] !== 'forbidden',
      );
  const tools = buildToolDefinitions(allowedSkills);

  // ── Agent loop ───────────────────────────────────────
  const ctx: SkillContext = { userId, sessionId, persona: persona.id, supabase: userClient, service };
  const executedActions: AgentLoopResult['executedActions'] = [];
  const awaitingApprovals: AgentLoopResult['awaitingApprovals'] = [];

  let finalReply = '';
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const llmResp = await callLLM(persona, messages, tools);

    messages.push({
      role: 'assistant',
      content: llmResp.content,
      tool_calls: llmResp.tool_calls,
    });

    // P2 #11 — persiste le texte intermédiaire (assistant qui parle AVANT d'appeler des tools)
    if (llmResp.tool_calls && llmResp.tool_calls.length > 0 && llmResp.content && llmResp.content.trim().length > 0) {
      await service.from('copilot_actions').insert({
        session_id: sessionId, user_id: userId, persona: persona.id,
        skill: '_assistant_intermediate', input: {},
        output: { content: llmResp.content, iteration: iterations },
        status: 'success', duration_ms: 0, action_category: 'system',
      });
    }

    if (!llmResp.tool_calls || llmResp.tool_calls.length === 0) {
      finalReply = llmResp.content ?? '';
      break;
    }

    // P0 #2 — dès qu'on rencontre une approval, on N'EXÉCUTE PLUS aucune skill
    // suivante du même batch. Les autos restantes sont mises en attente.
    let stopForApproval = false;
    for (const call of llmResp.tool_calls) {
      const skillName = call.function.name;
      const basePolicy = resolveSkillPolicy(persona, skillName);

      // P1 #5 — INVIOLABLE : même en mode créateur ces skills restent forbidden
      const isInviolable = FORBIDDEN_EVEN_IN_CREATOR.has(skillName);
      const policy = (isCreatorMode && getSkill(skillName) && !isInviolable) ? 'auto' : basePolicy;

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}');
      } catch {
        parsedArgs = {};
      }

      // FORBIDDEN — toujours rejeté, même après une approval (ne bloque pas le batch)
      if (policy === 'forbidden' || !getSkill(skillName) || isInviolable) {
        const errMsg = isInviolable
          ? `Skill '${skillName}' inviolable — interdite même en mode créateur (sécurité par design).`
          : 'Skill non autorisé pour cette persona';
        await logAction(service, sessionId, userId, persona.id, skillName, parsedArgs, null, 'rejected', errMsg, 0);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: skillName,
          content: JSON.stringify({ ok: false, error: errMsg }),
        });
        executedActions.push({ skill: skillName, status: 'rejected', error: isInviolable ? 'inviolable' : 'forbidden' });
        continue;
      }

      // Si une approval a déjà été rencontrée dans ce batch, on bascule TOUTES
      // les skills suivantes en attente d'approbation (même les autos).
      const effectivePolicy = stopForApproval ? 'approval' : policy;

      if (effectivePolicy === 'approval') {
        const { data: approvalAction } = await service
          .from('copilot_actions')
          .insert({
            session_id: sessionId, user_id: userId, persona: persona.id,
            skill: skillName, input: parsedArgs, status: 'awaiting_approval',
            action_category: categorizeAction(skillName),
          })
          .select('id').single();
        awaitingApprovals.push({ action_id: approvalAction?.id ?? '', skill: skillName, input: parsedArgs });
        executedActions.push({ skill: skillName, status: 'awaiting_approval', action_id: approvalAction?.id });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: skillName,
          content: JSON.stringify({
            ok: false,
            awaiting_approval: true,
            action_id: approvalAction?.id,
            note: stopForApproval
              ? 'Auto-skill mise en attente : une action précédente du même batch nécessite ton approbation.'
              : undefined,
          }),
        });
        stopForApproval = true;
      } else {
        // AUTO — P2 #13 : timeout 30s par skill (évite freeze sur fetch externe)
        const tStart = Date.now();
        const skill = getSkill(skillName)!;
        let result: { ok: boolean; data?: unknown; error?: string };
        try {
          result = await withTimeout(
            skill.handler(parsedArgs, ctx),
            SKILL_TIMEOUT_MS,
            `skill ${skillName}`,
          );
        } catch (e) {
          result = { ok: false, error: (e as Error).message };
        }
        const dur = Date.now() - tStart;
        const { data: insertedAction } = await service
          .from('copilot_actions')
          .insert({
            session_id: sessionId, user_id: userId, persona: persona.id,
            skill: skillName, input: parsedArgs,
            output: result.data ?? null,
            status: result.ok ? 'success' : 'error',
            error_message: result.ok ? null : result.error,
            duration_ms: dur,
            action_category: categorizeAction(skillName),
          })
          .select('id').single();
        executedActions.push({ skill: skillName, status: result.ok ? 'success' : 'error', output: result.data, error: result.error, action_id: insertedAction?.id });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: skillName,
          content: JSON.stringify(result),
        });
      }
    }

    if (stopForApproval) {
      finalReply = buildApprovalPromptText(awaitingApprovals);
      break;
    }
  }

  if (iterations >= MAX_ITERATIONS && !finalReply) {
    finalReply = "Désolé, je n'ai pas pu finaliser cette demande après plusieurs essais. Reformule ou précise ce que tu veux faire.";
  }

  return { finalReply, executedActions, awaitingApprovals, iterations };
}

// ═══════════════════════════════════════════════════════════
// Approval handler — exécute + relance LLM pour réponse contextuelle (P1 #7)
// ═══════════════════════════════════════════════════════════
async function handleApproval(args: {
  actionId: string;
  userId: string;
  userClient: ReturnType<typeof getUserClient>;
  service: ReturnType<typeof getServiceClient>;
  persona: PersonaConfig;
}) {
  const { actionId, userId, userClient, service, persona } = args;
  const t0 = Date.now();

  // P1 #8 — vérif persona stricte : on join sur la session pour confirmer
  // que l'action approuvée appartient bien à une session de la même persona.
  const { data: action, error } = await service
    .from('copilot_actions')
    .select('id, session_id, skill, input, persona, copilot_sessions!inner(persona, context)')
    .eq('id', actionId)
    .eq('user_id', userId)
    .eq('status', 'awaiting_approval')
    .maybeSingle();
  if (error || !action) return jsonError('Action introuvable ou déjà traitée', 404);

  // deno-lint-ignore no-explicit-any
  const sessionData = (action as any).copilot_sessions;
  const sessionPersona = sessionData?.persona;
  if (sessionPersona && sessionPersona !== persona.id) {
    return jsonError(`Persona incohérent : action liée à '${sessionPersona}', requête envoyée par '${persona.id}'.`, 400);
  }
  if (action.persona && action.persona !== persona.id) {
    return jsonError(`Persona incohérent : action créée par '${action.persona}'.`, 400);
  }

  const skill = getSkill(action.skill);
  if (!skill) {
    await service.from('copilot_actions').insert({
      session_id: action.session_id, user_id: userId, persona: persona.id,
      skill: action.skill, input: action.input, status: 'error',
      error_message: 'Skill introuvable au moment de l\'approbation',
      action_category: categorizeAction(action.skill),
    });
    return jsonError('Skill introuvable', 400);
  }

  const ctx: SkillContext = {
    userId, sessionId: action.session_id, persona: persona.id,
    supabase: userClient, service,
  };

  const tStart = Date.now();
  let result: { ok: boolean; data?: unknown; error?: string };
  // P2 #13 — timeout 30s sur l'exécution post-approbation aussi
  try {
    result = await withTimeout(
      skill.handler(action.input as Record<string, unknown>, ctx),
      SKILL_TIMEOUT_MS,
      `skill ${action.skill}`,
    );
  } catch (e) { result = { ok: false, error: (e as Error).message }; }
  const dur = Date.now() - tStart;

  // Insère une nouvelle ligne (audit trail immuable — on ne MAJ PAS l'ancienne)
  const { data: completed } = await service.from('copilot_actions').insert({
    session_id: action.session_id, user_id: userId, persona: persona.id,
    skill: action.skill, input: action.input,
    output: result.data ?? null,
    status: result.ok ? 'success' : 'error',
    error_message: result.ok ? null : result.error,
    duration_ms: dur,
    action_category: categorizeAction(action.skill),
  }).select('id').single();

  // P1 #7 — relance la boucle LLM avec un message user synthétique pour
  // que l'agent génère une réponse contextuelle ("c'est fait, voici le résultat").
  const sessionContext = (sessionData?.context as Record<string, unknown>) ?? {};
  const isCreatorMode = sessionContext.creator_mode === true;

  const userConfirm = result.ok
    ? `J'ai validé l'action **${action.skill}** que tu proposais. Elle a été exécutée avec succès. Résume-moi le résultat et propose la suite.`
    : `J'ai validé l'action **${action.skill}** mais elle a échoué (\`${result.error ?? 'erreur inconnue'}\`). Explique-moi ce qui s'est passé et propose une alternative.`;

  // Marque la session comme processing pendant le re-prompt
  await service.from('copilot_sessions')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', action.session_id).eq('user_id', userId);

  let loopResult: AgentLoopResult;
  try {
    loopResult = await runAgentLoop({
      persona,
      sessionId: action.session_id,
      userId,
      userMessage: userConfirm,
      isCreatorMode,
      userClient,
      service,
      t0,
      initialUserMessage: { role: 'user', content: userConfirm },
    });
  } finally {
    await service.from('copilot_sessions')
      .update({ status: 'active', processing_started_at: null })
      .eq('id', action.session_id).eq('user_id', userId);
  }

  // Persiste la paire user_message (synthétique) + assistant_reply
  await service.from('copilot_actions').insert([
    { session_id: action.session_id, user_id: userId, persona: persona.id, skill: '_user_message', input: { content: userConfirm, _synthetic: true, _trigger: 'approval', completed_action_id: completed?.id }, status: 'success', duration_ms: 0, action_category: 'system' },
    { session_id: action.session_id, user_id: userId, persona: persona.id, skill: '_assistant_reply', input: {}, output: { content: loopResult.finalReply }, status: 'success', duration_ms: Date.now() - t0, action_category: 'system' },
  ]);

  return jsonOk({
    session_id: action.session_id,
    approved_action_id: actionId,
    completed_action_id: completed?.id,
    result,
    reply: loopResult.finalReply,
    actions: loopResult.executedActions,
    awaiting_approvals: loopResult.awaitingApprovals,
    iterations: loopResult.iterations,
    persona: persona.id,
  });
}

// ═══════════════════════════════════════════════════════════
// Rejection handler — marque rejected + notifie LLM (P1 #6)
// ═══════════════════════════════════════════════════════════
async function handleRejection(args: {
  actionId: string;
  reason?: string;
  userId: string;
  userClient: ReturnType<typeof getUserClient>;
  service: ReturnType<typeof getServiceClient>;
  persona: PersonaConfig;
}) {
  const { actionId, reason, userId, userClient, service, persona } = args;
  const t0 = Date.now();

  // P1 #8 — vérif persona stricte
  const { data: action, error } = await service
    .from('copilot_actions')
    .select('id, session_id, skill, input, persona, copilot_sessions!inner(persona, context)')
    .eq('id', actionId)
    .eq('user_id', userId)
    .eq('status', 'awaiting_approval')
    .maybeSingle();
  if (error || !action) return jsonError('Action introuvable ou déjà traitée', 404);

  // deno-lint-ignore no-explicit-any
  const sessionData = (action as any).copilot_sessions;
  const sessionPersona = sessionData?.persona;
  if (sessionPersona && sessionPersona !== persona.id) {
    return jsonError(`Persona incohérent : action liée à '${sessionPersona}'.`, 400);
  }
  if (action.persona && action.persona !== persona.id) {
    return jsonError(`Persona incohérent : action créée par '${action.persona}'.`, 400);
  }

  // Sanitize la raison (max 500 chars, plain text)
  const safeReason = (reason ?? '').toString().trim().slice(0, 500) || 'Refus utilisateur (sans détail)';

  // Insère une ligne 'rejected' immuable (audit trail)
  const { data: rejected } = await service.from('copilot_actions').insert({
    session_id: action.session_id, user_id: userId, persona: persona.id,
    skill: action.skill, input: action.input,
    output: { rejected: true, reason: safeReason },
    status: 'rejected',
    error_message: safeReason,
    duration_ms: 0,
    action_category: categorizeAction(action.skill),
  }).select('id').single();

  // P1 #7 — relance la boucle LLM avec un message user expliquant le rejet
  const sessionContext = (sessionData?.context as Record<string, unknown>) ?? {};
  const isCreatorMode = sessionContext.creator_mode === true;

  const userReject = `J'ai refusé l'action **${action.skill}** que tu proposais. Raison : ${safeReason}. Propose-moi une alternative ou demande-moi plus de précisions.`;

  await service.from('copilot_sessions')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', action.session_id).eq('user_id', userId);

  let loopResult: AgentLoopResult;
  try {
    loopResult = await runAgentLoop({
      persona,
      sessionId: action.session_id,
      userId,
      userMessage: userReject,
      isCreatorMode,
      userClient,
      service,
      t0,
      initialUserMessage: { role: 'user', content: userReject },
    });
  } finally {
    await service.from('copilot_sessions')
      .update({ status: 'active', processing_started_at: null })
      .eq('id', action.session_id).eq('user_id', userId);
  }

  await service.from('copilot_actions').insert([
    { session_id: action.session_id, user_id: userId, persona: persona.id, skill: '_user_message', input: { content: userReject, _synthetic: true, _trigger: 'rejection', rejected_action_id: rejected?.id }, status: 'success', duration_ms: 0, action_category: 'system' },
    { session_id: action.session_id, user_id: userId, persona: persona.id, skill: '_assistant_reply', input: {}, output: { content: loopResult.finalReply }, status: 'success', duration_ms: Date.now() - t0, action_category: 'system' },
  ]);

  return jsonOk({
    session_id: action.session_id,
    rejected_action_id: actionId,
    rejection_record_id: rejected?.id,
    reply: loopResult.finalReply,
    actions: loopResult.executedActions,
    awaiting_approvals: loopResult.awaitingApprovals,
    iterations: loopResult.iterations,
    persona: persona.id,
  });
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Charge l'historique conversationnel ET les exécutions de skills.
 *
 * P0 #1 — On reconstruit toute la chaîne :
 *   - _user_message → role='user'
 *   - _assistant_reply → role='assistant' (texte final)
 *   - skill métier (read_*, navigate_to, cms_*, …) → paire assistant(tool_call) + tool(tool_result)
 *
 * Sans ça, après une approbation le LLM ne voyait jamais le résultat de l'action exécutée
 * et pouvait re-demander la même skill en boucle.
 *
 * On limite à HISTORY_LIMIT messages texte (user/assistant) et on injecte TOUTES les
 * actions skills associées (peu nombreuses en pratique). Les actions internes type
 * _security_violation / _assistant_intermediate sont ignorées.
 */
async function loadHistory(
  service: ReturnType<typeof getServiceClient>,
  sessionId: string,
  userId: string,
): Promise<ChatMessage[]> {
  const { data } = await service
    .from('copilot_actions')
    .select('id, skill, input, output, status, error_message, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT * 4); // marge pour inclure les tool_calls intercalés
  if (!data || data.length === 0) return [];

  // On ne garde QUE les HISTORY_LIMIT dernières paires user/assistant
  // mais on conserve toutes les actions skills entre elles.
  const textRows = data.filter((r) => r.skill === '_user_message' || r.skill === '_assistant_reply');
  const cutoffIdx = textRows.length > HISTORY_LIMIT
    ? data.findIndex((r) => r.id === textRows[textRows.length - HISTORY_LIMIT].id)
    : 0;
  const trimmed = data.slice(Math.max(0, cutoffIdx));

  const messages: ChatMessage[] = [];
  for (const row of trimmed) {
    // _security_violation : interne, jamais envoyé au LLM.
    // _assistant_intermediate : déjà inclus implicitement via le tool_call suivant — éviter doublon.
    if (row.skill === '_security_violation' || row.skill === '_assistant_intermediate') continue;

    if (row.skill === '_user_message') {
      const content = (row.input as { content?: string })?.content ?? '';
      messages.push({ role: 'user', content });
      continue;
    }
    if (row.skill === '_assistant_reply') {
      const content = (row.output as { content?: string })?.content ?? '';
      messages.push({ role: 'assistant', content });
      continue;
    }

    const toolCallId = `hist_${row.id.replace(/-/g, '').slice(0, 24)}`;
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: toolCallId,
        type: 'function',
        function: {
          name: row.skill,
          arguments: JSON.stringify(row.input ?? {}),
        },
      }],
    });

    let toolResult: unknown;
    if (row.status === 'awaiting_approval') {
      toolResult = { ok: false, awaiting_approval: true, action_id: row.id };
    } else if (row.status === 'rejected') {
      toolResult = { ok: false, error: row.error_message ?? 'Action rejetée par l\'utilisateur', rejected: true };
    } else if (row.status === 'error') {
      toolResult = { ok: false, error: row.error_message ?? 'Erreur skill' };
    } else {
      // P2 #15 — tronque les outputs volumineux pour ne pas exploser la fenêtre LLM
      toolResult = { ok: true, data: summarizeForHistory(row.output) };
    }
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name: row.skill,
      content: JSON.stringify(toolResult),
    });
  }
  return messages;
}

async function callLLM(
  persona: PersonaConfig,
  messages: ChatMessage[],
  tools: unknown[],
): Promise<{ content: string | null; tool_calls?: ChatMessage['tool_calls']; finish_reason?: string }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY manquante');

  // P2 #13 — timeout 45s + AbortController pour libérer la connexion
  const r = await withAbortableTimeout(
    (signal) => fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: persona.model,
        max_tokens: persona.maxOutputTokens,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      }),
      signal,
    }),
    LLM_TIMEOUT_MS,
    'LLM Gateway',
  );

  if (r.status === 429) throw new Error('LLM rate-limit (429). Réessaie dans quelques secondes.');
  if (r.status === 402) throw new Error('Crédits LLM épuisés (402). Recharge le workspace.');
  if (!r.ok) throw new Error(`LLM Gateway ${r.status} : ${(await r.text()).slice(0, 300)}`);

  const data = await r.json();
  const choice = data?.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    tool_calls: choice?.message?.tool_calls,
    finish_reason: choice?.finish_reason,
  };
}

function buildApprovalPromptText(approvals: Array<{ skill: string; input: unknown; action_id: string }>): string {
  if (approvals.length === 0) return '';
  const lines = approvals.map(
    (a) => `• **${a.skill}** — paramètres : \`${JSON.stringify(a.input)}\` (action #${a.action_id.slice(0, 8)})`,
  );
  return [
    "J'aimerais lancer la ou les actions suivantes. Dis-moi si je peux y aller :",
    '',
    ...lines,
    '',
    "Réponds **valider** pour confirmer, ou précise autre chose pour ajuster.",
  ].join('\n');
}

/** Log d'une action skill dans copilot_actions (audit trail immuable). */
async function logAction(
  service: ReturnType<typeof getServiceClient>,
  sessionId: string,
  userId: string,
  personaId: string,
  skill: string,
  input: Record<string, unknown>,
  output: unknown,
  status: 'success' | 'error' | 'rejected' | 'awaiting_approval',
  errorMessage: string | null,
  durationMs: number,
): Promise<void> {
  await service.from('copilot_actions').insert({
    session_id: sessionId,
    user_id: userId,
    persona: personaId,
    skill,
    input,
    output,
    status,
    error_message: errorMessage,
    duration_ms: durationMs,
    action_category: categorizeAction(skill),
  });
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}
function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
