/**
 * copilot-orchestrator — Backend unique multi-personas.
 *
 * Un seul edge function pour servir Félix ET Stratège Cocoon (et tous les
 * futurs personas). La personnalité, les skills accessibles et le modèle LLM
 * sont déterminés par le paramètre `persona` à l'invocation.
 *
 * POST /copilot-orchestrator
 *   body: { persona: 'felix' | 'strategist', session_id?: string, message: string, context?: object }
 *   res:  { session_id, reply, actions: CopilotAction[] }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { getPersonaConfig, resolveSkillPolicy, type PersonaConfig } from './personas.ts';
import { getSkill, type SkillContext } from './skills/registry.ts';

interface OrchestratorBody {
  persona: string;
  session_id?: string;
  message: string;
  context?: Record<string, unknown>;
}

interface CopilotActionRecord {
  skill: string;
  status: 'success' | 'error' | 'awaiting_approval';
  output?: unknown;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Non authentifié', 401);
    }
    const userClient = getUserClient(authHeader);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return jsonError('Token invalide', 401);
    }
    const userId = claims.claims.sub as string;

    // ── Body ─────────────────────────────────────────────
    const body = (await req.json()) as OrchestratorBody;
    if (!body.persona || !body.message) {
      return jsonError('persona et message requis', 400);
    }

    const persona = getPersonaConfig(body.persona);
    if (!persona) {
      return jsonError(`Persona inconnu : ${body.persona}`, 400);
    }

    const service = getServiceClient();

    // ── Session : récupérer ou créer ─────────────────────
    let sessionId = body.session_id;
    if (!sessionId) {
      const { data: created, error: cErr } = await service
        .from('copilot_sessions')
        .insert({
          user_id: userId,
          persona: persona.id,
          context: body.context ?? {},
          title: body.message.slice(0, 80),
        })
        .select('id')
        .single();
      if (cErr || !created) return jsonError(`Création session : ${cErr?.message}`, 500);
      sessionId = created.id;
    } else {
      // Touche last_message_at
      await service
        .from('copilot_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);
    }

    // ── Appel LLM (squelette — l'agent loop complet viendra Sprint 2)
    const reply = await callLovableAI(persona, body.message, body.context ?? {});

    // ── Stub : aucune action exécutée pour l'instant ────
    const actions: CopilotActionRecord[] = [];

    return jsonOk({ session_id: sessionId, reply, actions, persona: persona.id });
  } catch (e) {
    console.error('[copilot-orchestrator] Erreur:', e);
    return jsonError((e as Error).message, 500);
  }
});

// ─── Helpers LLM ─────────────────────────────────────────────
async function callLovableAI(persona: PersonaConfig, userMessage: string, context: Record<string, unknown>): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY manquante');

  const contextStr = Object.keys(context).length > 0
    ? `\n\nContexte courant :\n${JSON.stringify(context, null, 2)}`
    : '';

  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: persona.model,
      max_tokens: persona.maxOutputTokens,
      messages: [
        { role: 'system', content: persona.systemPrompt + contextStr },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`LLM Gateway ${r.status} : ${errText.slice(0, 300)}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// ─── Helpers HTTP ────────────────────────────────────────────
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

// Suppress unused warnings — sera utilisé Sprint 2 (agent loop).
void getSkill;
void resolveSkillPolicy;
void ({} as SkillContext);
