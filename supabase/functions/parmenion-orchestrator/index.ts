import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Parménion — Orchestrateur stratégique pour Autopilot
 * 
 * 3 piliers de décision:
 * 1. BUT: objectif précis au niveau cluster max
 * 2. TACTIQUE: réduction de scope si trop complexe (tokens)
 * 3. PRUDENCE: scoring impact/risque, max risque 3, itérations si 4+
 * 
 * Apprentissage: few-shot des erreurs passées injectées dans le prompt.
 * Mode conservateur si taux d'erreur > 20% sur les 10 dernières décisions.
 */

const CONSERVATIVE_THRESHOLD = 20; // % — triggers conservative mode
const MAX_RISK_NORMAL = 3;
const MAX_RISK_CONSERVATIVE = 2;
const MAX_RISK_ITERATIONS = 3;
const MAX_TOKEN_BUDGET = 8000; // tokens max per cycle action
const IMPACT_LEVELS = ['faible', 'modéré', 'neutre', 'avancé', 'très_avancé'] as const;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Accept service-role calls (from autopilot-engine) or admin users
    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___none___');
    
    let authUserId: string | null = null;
    if (!isServiceRole) {
      const auth = await getAuthenticatedUser(req);
      if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!auth.isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      authUserId = auth.userId;
    }

    const { tracked_site_id, domain, cycle_number = 1 } = await req.json();
    if (!tracked_site_id || !domain) {
      return new Response(JSON.stringify({ error: 'tracked_site_id and domain required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();

    // ═══ PHASE 0: Check error rate → conservative mode? ═══
    const { data: errorRateData } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    const conservativeMode = errorRateData?.conservative_mode === true;
    const maxRisk = conservativeMode ? MAX_RISK_CONSERVATIVE : MAX_RISK_NORMAL;
    
    console.log(`[Parménion] Domain: ${domain}, Cycle: ${cycle_number}, Conservative: ${conservativeMode}, MaxRisk: ${maxRisk}`);

    // ═══ PHASE 1: Gather context ═══
    const [diagnosticsRes, cocoonRes, errorsRes, lastDecisionsRes] = await Promise.all([
      // Latest diagnostics
      supabase.from('cocoon_diagnostic_results')
        .select('diagnostic_type, scores, findings, created_at')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(4),
      // Latest cocoon session
      supabase.from('cocoon_sessions')
        .select('cluster_summary, nodes_count, clusters_count, intent_distribution, avg_geo_score, avg_eeat_score, avg_content_gap, avg_cannibalization_risk')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Past errors for few-shot learning
      supabase.rpc('parmenion_recent_errors', { p_domain: domain }),
      // Last 5 decisions for continuity
      supabase.from('parmenion_decision_log')
        .select('goal_type, goal_description, action_type, status, impact_level, risk_predicted, is_error, created_at')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const diagnostics = diagnosticsRes.data || [];
    const cocoon = cocoonRes.data;
    const pastErrors = errorsRes.data || [];
    const lastDecisions = lastDecisionsRes.data || [];

    // ═══ PHASE 2: LLM Decision — BUT + TACTIQUE + PRUDENCE ═══
    const decision = await askParmenionLLM({
      domain,
      cycle_number,
      conservativeMode,
      maxRisk,
      diagnostics,
      cocoon,
      pastErrors,
      lastDecisions,
    });

    if (!decision) {
      return new Response(JSON.stringify({ error: 'Parménion could not produce a decision' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ PHASE 3: Persist decision ═══
    const logEntry = {
      tracked_site_id,
      user_id: authUserId || tracked_site_id, // fallback for service-role calls
      domain,
      cycle_number,
      goal_type: decision.goal.type,
      goal_cluster_id: decision.goal.cluster_id || null,
      goal_description: decision.goal.description,
      initial_scope: decision.tactic.initial_scope,
      final_scope: decision.tactic.final_scope,
      scope_reductions: decision.tactic.scope_reductions,
      estimated_tokens: decision.tactic.estimated_tokens,
      impact_level: decision.prudence.impact_level,
      impact_predicted: decision.prudence.impact_level,
      risk_predicted: decision.prudence.risk_score,
      risk_iterations: decision.prudence.iterations,
      goal_changed: decision.prudence.goal_changed,
      action_type: decision.action.type,
      action_payload: decision.action.payload,
      functions_called: decision.action.functions,
      status: 'planned',
    };

    const { data: logData, error: logError } = await supabase
      .from('parmenion_decision_log')
      .insert(logEntry)
      .select('id')
      .single();

    if (logError) {
      console.error('[Parménion] Failed to persist decision:', logError);
      return new Response(JSON.stringify({ error: 'Failed to persist decision' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      decision_id: logData.id,
      decision,
      conservative_mode: conservativeMode,
      error_rate: errorRateData,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[Parménion] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ═══════════════════════════════════════════════════════════════
// LLM REASONING ENGINE
// ═══════════════════════════════════════════════════════════════

interface ParmenionDecision {
  goal: { type: string; cluster_id?: string; description: string };
  tactic: { initial_scope: any; final_scope: any; scope_reductions: number; estimated_tokens: number };
  prudence: { impact_level: string; risk_score: number; iterations: number; goal_changed: boolean; reasoning: string };
  action: { type: string; payload: any; functions: string[] };
  summary: string;
}

async function askParmenionLLM(context: {
  domain: string;
  cycle_number: number;
  conservativeMode: boolean;
  maxRisk: number;
  diagnostics: any[];
  cocoon: any;
  pastErrors: any[];
  lastDecisions: any[];
}): Promise<ParmenionDecision | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[Parménion] LOVABLE_API_KEY not configured');
    return null;
  }

  const errorHistory = context.pastErrors.length > 0
    ? `\n\nHISTORIQUE D'ERREURS SUR CE DOMAINE (à prendre en compte pour calibrer le risque):\n${context.pastErrors.map((e: any, i: number) => 
        `- Cycle #${e.cycle_number}: risque estimé ${e.risk_predicted} → réel ${e.risk_calibrated}. Impact prévu "${e.impact_predicted}" → réel "${e.impact_actual}". Cause: ${e.calibration_note || e.error_category || 'inconnue'}.`
      ).join('\n')}`
    : '';

  const recentDecisions = context.lastDecisions.length > 0
    ? `\n\nDERNIÈRES DÉCISIONS (pour éviter les redondances):\n${context.lastDecisions.map((d: any) => 
        `- ${d.goal_description} [${d.action_type}] → ${d.status}${d.is_error ? ' ⚠️ ERREUR' : ''}`
      ).join('\n')}`
    : '';

  const systemPrompt = `Tu es Parménion, stratège SEO de l'autopilote Crawlers.fr. Tu prends une SEULE décision par cycle, ciblée et prudente.

## TES 3 PILIERS DE DÉCISION

### 1. BUT
- Choisis UN objectif précis, jamais global
- Échelle maximum: le cluster (pas le domaine entier)
- Types possibles: cluster_optimization, content_gap, linking, technical_fix
- Ne répète pas un but récent (voir historique)

### 2. TACTIQUE  
- Estime les tokens nécessaires pour l'action
- Si > ${MAX_TOKEN_BUDGET} tokens → réduis le scope (moins de pages)
- Note combien de fois tu as réduit le scope

### 3. PRUDENCE
- Impact: faible | modéré | neutre | avancé | très_avancé
- Risque: 1 à ${context.maxRisk} MAXIMUM${context.conservativeMode ? ' (MODE CONSERVATEUR ACTIF — taux d\'erreur > 20%)' : ''}
- Si ton évaluation donne risque 4 ou 5, reprends à TACTIQUE et réduis
- Si après 3 itérations le risque ne baisse pas → change de BUT
- INTERDICTIONS ABSOLUES: supprimer des pages, modifier la charte graphique

## FONCTIONS DISPONIBLES
- cocoon-diag-content: diagnostic contenu
- cocoon-diag-semantic: diagnostic sémantique  
- cocoon-diag-structure: diagnostic structure
- cocoon-diag-authority: diagnostic autorité
- cocoon-strategist: plan stratégique
- calculate-cocoon-logic: calcul cocon sémantique
- generate-corrective-code: génération de code correctif
- audit-expert-seo: audit SEO complet
- wpsync: déploiement WordPress
${errorHistory}${recentDecisions}

## FORMAT DE RÉPONSE (JSON strict)
Tu dois retourner un JSON avec cette structure exacte, sans texte autour:
{
  "goal": { "type": "...", "cluster_id": "...", "description": "..." },
  "tactic": { "initial_scope": {...}, "final_scope": {...}, "scope_reductions": 0, "estimated_tokens": 0 },
  "prudence": { "impact_level": "...", "risk_score": 1, "iterations": 0, "goal_changed": false, "reasoning": "..." },
  "action": { "type": "...", "payload": {...}, "functions": ["..."] },
  "summary": "..."
}`;

  const userPrompt = `Domaine: ${context.domain}
Cycle: ${context.cycle_number}
Mode conservateur: ${context.conservativeMode ? 'OUI (risque max: 2)' : 'NON (risque max: 3)'}

DIAGNOSTICS DISPONIBLES:
${JSON.stringify(context.diagnostics.map(d => ({ type: d.diagnostic_type, scores: d.scores })), null, 2)}

COCON SÉMANTIQUE:
${context.cocoon ? JSON.stringify({
  clusters: context.cocoon.clusters_count,
  nodes: context.cocoon.nodes_count,
  geo_score: context.cocoon.avg_geo_score,
  eeat_score: context.cocoon.avg_eeat_score,
  content_gap: context.cocoon.avg_content_gap,
  cannibalization: context.cocoon.avg_cannibalization_risk,
  cluster_summary: context.cocoon.cluster_summary,
}, null, 2) : 'Aucun cocon calculé'}

Quelle est ta décision pour ce cycle ?`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        tools: [{
          type: 'function',
          function: {
            name: 'parmenion_decide',
            description: 'Submit Parménion decision for this autopilot cycle',
            parameters: {
              type: 'object',
              properties: {
                goal: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['cluster_optimization', 'content_gap', 'linking', 'technical_fix'] },
                    cluster_id: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['type', 'description'],
                },
                tactic: {
                  type: 'object',
                  properties: {
                    initial_scope: { type: 'object' },
                    final_scope: { type: 'object' },
                    scope_reductions: { type: 'integer' },
                    estimated_tokens: { type: 'integer' },
                  },
                  required: ['initial_scope', 'final_scope', 'scope_reductions', 'estimated_tokens'],
                },
                prudence: {
                  type: 'object',
                  properties: {
                    impact_level: { type: 'string', enum: ['faible', 'modéré', 'neutre', 'avancé', 'très_avancé'] },
                    risk_score: { type: 'integer', minimum: 1, maximum: 3 },
                    iterations: { type: 'integer' },
                    goal_changed: { type: 'boolean' },
                    reasoning: { type: 'string' },
                  },
                  required: ['impact_level', 'risk_score', 'iterations', 'goal_changed', 'reasoning'],
                },
                action: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    payload: { type: 'object' },
                    functions: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['type', 'payload', 'functions'],
                },
                summary: { type: 'string' },
              },
              required: ['goal', 'tactic', 'prudence', 'action', 'summary'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'parmenion_decide' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Parménion] LLM error ${response.status}:`, errText);
      return null;
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('[Parménion] No tool call in LLM response');
      return null;
    }

    const decision = JSON.parse(toolCall.function.arguments) as ParmenionDecision;

    // ═══ PRUDENCE GUARD: enforce risk ceiling ═══
    if (decision.prudence.risk_score > context.maxRisk) {
      console.warn(`[Parménion] Risk ${decision.prudence.risk_score} exceeds max ${context.maxRisk}, clamping`);
      decision.prudence.risk_score = context.maxRisk;
    }

    return decision;
  } catch (e) {
    console.error('[Parménion] LLM call failed:', e);
    return null;
  }
}

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler);
}
