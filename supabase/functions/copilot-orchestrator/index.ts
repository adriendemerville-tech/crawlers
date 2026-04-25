/**
 * copilot-orchestrator — Sprint 2 : agent loop + skills + persistence + approval.
 *
 * POST /copilot-orchestrator
 *   body : {
 *     persona: 'felix' | 'strategist',
 *     session_id?: string,
 *     message: string,
 *     context?: object,
 *     approve_action_id?: string   // pour ré-exécuter une action awaiting_approval
 *   }
 *   res  : { session_id, reply, actions, persona, awaiting_approvals }
 *
 * Boucle :
 *   1. Charge l'historique de la session.
 *   2. Appelle Lovable AI Gateway avec system prompt + tools de la persona.
 *   3. Si tool_calls → résout chaque skill via la policy (auto / approval / forbidden).
 *      - auto : exécute, log dans copilot_actions(status=success|error), réinjecte le résultat.
 *      - approval : crée copilot_actions(status=awaiting_approval), STOP la boucle.
 *      - forbidden : log status=rejected, réinjecte erreur "non autorisé".
 *   4. Re-prompt jusqu'à `finish_reason=stop` ou max 6 itérations.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import {
  getPersonaConfig,
  resolveSkillPolicy,
  type PersonaConfig,
} from './personas.ts';
import { getSkill, buildToolDefinitions, listSkills, type SkillContext } from './skills/registry.ts';

interface OrchestratorBody {
  persona: string;
  session_id?: string;
  message?: string;
  context?: Record<string, unknown>;
  approve_action_id?: string;
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

    // ── Cas approbation : ré-exécute une action awaiting_approval ──
    if (body.approve_action_id) {
      return await handleApproval({
        actionId: body.approve_action_id,
        userId,
        userClient,
        service,
        persona,
      });
    }

    if (!body.message) return jsonError('message requis', 400);

    // ── Préfixe admin /creator: /createur: /admin: ────────
    // Permet à l'administrateur (rôle 'admin') de débloquer les skills sensibles
    // (CMS, déploiements, actions destructrices) en passant en mode "creator".
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
    if (!body.session_id) {
      const { data: created, error: cErr } = await service
        .from('copilot_sessions')
        .insert({
          user_id: userId,
          persona: persona.id,
          context: body.context ?? {},
          title: body.message.slice(0, 80),
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (cErr || !created) return jsonError(`Création session : ${cErr?.message}`, 500);
      sessionId = created.id;
      sessionIdForCleanup = sessionId;
    } else {
      sessionId = body.session_id;
      sessionIdForCleanup = sessionId;

      // Reconciliation : si la session est en 'processing' depuis > 90s, on la débloque.
      // (Cas crash entre tool_calls et persist final → message fantôme à éviter.)
      const { data: existingSess } = await service
        .from('copilot_sessions')
        .select('status, processing_started_at')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSess?.status === 'processing' && existingSess.processing_started_at) {
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
        });
      }

      await service
        .from('copilot_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', userId);
    }

    // ── Historique conversation ──────────────────────────
    const history = await loadHistory(service, sessionId, userId);

    // ── Construit messages pour LLM ──────────────────────
    const contextStr = body.context && Object.keys(body.context).length > 0
      ? `\n\nContexte courant :\n${JSON.stringify(body.context, null, 2)}`
      : '';

    const creatorBanner = isCreatorMode
      ? `\n\n## ⚙️ MODE CRÉATEUR ACTIF\nL'administrateur créateur (rôle 'admin') t'a invoqué via le préfixe \`/creator :\` (ou \`/createur :\`, \`/admin :\`).\nDans ce mode :\n- Toutes les skills disponibles sont débloquées et exécutables sans approbation préalable (auto).\n- Les actions destructrices (CMS publish/patch, déploiements) sont autorisées.\n- Tu peux consulter le backend, dispatcher des directives, et agir au nom du créateur.\nLe préfixe a été retiré du message ci-dessous — réponds à la demande réelle du créateur.\n`
      : '';

    const messages: ChatMessage[] = [
      { role: 'system', content: persona.systemPrompt + creatorBanner + contextStr },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // ── Tools autorisés (auto + approval, on EXCLUT forbidden) ──
    // En mode créateur : toutes les skills du registry sont accessibles.
    const allowedSkills = isCreatorMode
      ? Array.from(new Set([...Object.keys(persona.skillPolicies), ...listSkills()]))
      : Object.keys(persona.skillPolicies).filter(
          (s) => persona.skillPolicies[s] !== 'forbidden',
        );
    const tools = buildToolDefinitions(allowedSkills);

    // ── Agent loop ───────────────────────────────────────
    const ctx: SkillContext = { userId, sessionId, persona: persona.id, supabase: userClient, service };
    const executedActions: Array<{ skill: string; status: string; output?: unknown; error?: string; action_id?: string }> = [];
    const awaitingApprovals: Array<{ action_id: string; skill: string; input: unknown }> = [];

    let finalReply = '';
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const llmResp = await callLLM(persona, messages, tools);

      // Push le message assistant (avec ses éventuels tool_calls) dans l'historique courant.
      messages.push({
        role: 'assistant',
        content: llmResp.content,
        tool_calls: llmResp.tool_calls,
      });

      // Pas de tool calls → c'est la réponse finale
      if (!llmResp.tool_calls || llmResp.tool_calls.length === 0) {
        finalReply = llmResp.content ?? '';
        break;
      }

      // Résout chaque tool call
      let stopForApproval = false;
      for (const call of llmResp.tool_calls) {
        const skillName = call.function.name;
        // En mode créateur : toute skill connue passe en exécution automatique.
        const basePolicy = resolveSkillPolicy(persona, skillName);
        const policy = isCreatorMode && getSkill(skillName) ? 'auto' : basePolicy;
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        // FORBIDDEN
        if (policy === 'forbidden' || !getSkill(skillName)) {
          await logAction(service, sessionId, userId, persona.id, skillName, parsedArgs, null, 'rejected', 'Skill non autorisé pour cette persona', 0);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: skillName,
            content: JSON.stringify({ ok: false, error: 'Skill non autorisé pour cette persona' }),
          });
          executedActions.push({ skill: skillName, status: 'rejected', error: 'forbidden' });
          continue;
        }

        // APPROVAL : on enregistre, on stoppe la boucle.
        if (policy === 'approval') {
          const { data: approvalAction } = await service
            .from('copilot_actions')
            .insert({
              session_id: sessionId, user_id: userId, persona: persona.id,
              skill: skillName, input: parsedArgs, status: 'awaiting_approval',
            })
            .select('id').single();
          awaitingApprovals.push({ action_id: approvalAction?.id ?? '', skill: skillName, input: parsedArgs });
          executedActions.push({ skill: skillName, status: 'awaiting_approval', action_id: approvalAction?.id });
          // Réponse synthétique pour le LLM (mais on coupe la boucle après)
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: skillName,
            content: JSON.stringify({ ok: false, awaiting_approval: true, action_id: approvalAction?.id }),
          });
          stopForApproval = true;
        } else {
          // AUTO
          const tStart = Date.now();
          const skill = getSkill(skillName)!;
          let result;
          try {
            result = await skill.handler(parsedArgs, ctx);
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
        // Demande à l'utilisateur de valider via une réponse explicite
        finalReply = buildApprovalPromptText(awaitingApprovals);
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS && !finalReply) {
      finalReply = "Désolé, je n'ai pas pu finaliser cette demande après plusieurs essais. Reformule ou précise ce que tu veux faire.";
    }

    // Persiste le message utilisateur + réponse finale comme paire conversation
    await service.from('copilot_actions').insert([
      { session_id: sessionId, user_id: userId, persona: persona.id, skill: '_user_message', input: { content: body.message }, status: 'success', duration_ms: 0 },
      { session_id: sessionId, user_id: userId, persona: persona.id, skill: '_assistant_reply', input: {}, output: { content: finalReply }, status: 'success', duration_ms: Date.now() - t0 },
    ]);

    // Libère le statut processing → active (succès nominal)
    await service.from('copilot_sessions')
      .update({ status: 'active', processing_started_at: null })
      .eq('id', sessionId).eq('user_id', userId);

    return jsonOk({
      session_id: sessionId,
      reply: finalReply,
      actions: executedActions,
      awaiting_approvals: awaitingApprovals,
      persona: persona.id,
      iterations,
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
// Approval handler — exécute une action awaiting_approval
// ═══════════════════════════════════════════════════════════
async function handleApproval(args: {
  actionId: string;
  userId: string;
  userClient: ReturnType<typeof getUserClient>;
  service: ReturnType<typeof getServiceClient>;
  persona: PersonaConfig;
}) {
  const { actionId, userId, userClient, service, persona } = args;
  const { data: action, error } = await service
    .from('copilot_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .eq('status', 'awaiting_approval')
    .maybeSingle();
  if (error || !action) return jsonError('Action introuvable ou déjà traitée', 404);

  const skill = getSkill(action.skill);
  if (!skill) {
    await service.from('copilot_actions').insert({
      session_id: action.session_id, user_id: userId, persona: persona.id,
      skill: action.skill, input: action.input, status: 'error',
      error_message: 'Skill introuvable au moment de l\'approbation',
    });
    return jsonError('Skill introuvable', 400);
  }

  const ctx: SkillContext = {
    userId, sessionId: action.session_id, persona: persona.id,
    supabase: userClient, service,
  };
  const tStart = Date.now();
  let result;
  try { result = await skill.handler(action.input as Record<string, unknown>, ctx); }
  catch (e) { result = { ok: false, error: (e as Error).message }; }
  const dur = Date.now() - tStart;

  // Insère une nouvelle ligne (audit trail immuable — on ne MAJ PAS l'ancienne)
  const { data: completed } = await service.from('copilot_actions').insert({
    session_id: action.session_id, user_id: userId, persona: persona.id,
    skill: action.skill, input: action.input,
    output: result.data ?? null,
    status: result.ok ? 'success' : 'error',
    error_message: result.ok ? null : result.error,
    duration_ms: dur,
  }).select('id').single();

  return jsonOk({
    session_id: action.session_id,
    approved_action_id: actionId,
    completed_action_id: completed?.id,
    result,
  });
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

async function loadHistory(
  service: ReturnType<typeof getServiceClient>,
  sessionId: string,
  userId: string,
): Promise<ChatMessage[]> {
  const { data } = await service
    .from('copilot_actions')
    .select('skill, input, output, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .in('skill', ['_user_message', '_assistant_reply'])
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (!data) return [];
  return data
    .reverse()
    .map((row): ChatMessage | null => {
      if (row.skill === '_user_message') {
        const content = (row.input as { content?: string })?.content ?? '';
        return { role: 'user', content };
      }
      if (row.skill === '_assistant_reply') {
        const content = (row.output as { content?: string })?.content ?? '';
        return { role: 'assistant', content };
      }
      return null;
    })
    .filter((m): m is ChatMessage => m !== null);
}

async function callLLM(
  persona: PersonaConfig,
  messages: ChatMessage[],
  tools: unknown[],
): Promise<{ content: string | null; tool_calls?: ChatMessage['tool_calls']; finish_reason?: string }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY manquante');

  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: persona.model,
      max_tokens: persona.maxOutputTokens,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    }),
  });

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
