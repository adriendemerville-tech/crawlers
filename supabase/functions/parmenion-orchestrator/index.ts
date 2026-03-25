import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Parménion — Orchestrateur stratégique autonome pour Autopilot
 * 
 * Pipeline obligatoire en 3 phases:
 *   1. DIAGNOSE: audit-expert-seo, cocoon-diag-*
 *   2. PRESCRIBE: cocoon-strategist, calculate-cocoon-logic, generate-corrective-code
 *   3. EXECUTE: wpsync (WordPress) OU iktracker-actions (IKtracker)
 * 
 * Chaque cycle avance d'une phase. Parménion ne recule jamais.
 * Les résultats de chaque phase alimentent la suivante.
 */

const CONSERVATIVE_THRESHOLD = 20;
const MAX_RISK_NORMAL = 3;
const MAX_RISK_CONSERVATIVE = 2;
const MAX_TOKEN_BUDGET = 8000;

// Pipeline phases in strict order
const PIPELINE_PHASES = ['diagnose', 'prescribe', 'execute'] as const;
type PipelinePhase = typeof PIPELINE_PHASES[number];

const PHASE_FUNCTIONS: Record<PipelinePhase, string[]> = {
  diagnose: ['audit-expert-seo', 'cocoon-diag-content', 'cocoon-diag-semantic', 'cocoon-diag-structure', 'cocoon-diag-authority'],
  prescribe: ['cocoon-strategist', 'calculate-cocoon-logic', 'generate-corrective-code'],
  execute: ['wpsync', 'iktracker-actions'],
};

function isIktrackerDomain(domain: string): boolean {
  return domain.toLowerCase().includes('iktracker');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___none___');
    
    let authUserId: string | null = null;
    if (!isServiceRole) {
      const auth = await getAuthenticatedUser(req);
      if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!auth.isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      authUserId = auth.userId;
    }

    const { tracked_site_id, domain, cycle_number = 1, user_id: bodyUserId } = await req.json();
    if (!tracked_site_id || !domain) {
      return new Response(JSON.stringify({ error: 'tracked_site_id and domain required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();
    const isIktracker = isIktrackerDomain(domain);

    // ═══ PHASE 0: Determine current pipeline phase ═══
    const { data: lastCompletedDecisions } = await supabase
      .from('parmenion_decision_log')
      .select('pipeline_phase, status, execution_results, goal_type, goal_description, action_type, functions_called, execution_error, created_at')
      .eq('domain', domain)
      .in('status', ['completed', 'dry_run'])
      .order('created_at', { ascending: false })
      .limit(10);

    const completedPhases = (lastCompletedDecisions || [])
      .map(d => d.pipeline_phase)
      .filter(Boolean);

    // Determine next phase: advance through pipeline
    let currentPhase: PipelinePhase = 'diagnose';
    const lastPhase = completedPhases[0] as PipelinePhase | undefined;
    
    if (lastPhase === 'diagnose') {
      const lastDiagnostic = (lastCompletedDecisions || []).find(d => d.pipeline_phase === 'diagnose' && d.execution_results);
      if (lastDiagnostic) {
        currentPhase = 'prescribe';
      }
    } else if (lastPhase === 'prescribe') {
      const lastPrescription = (lastCompletedDecisions || []).find(d => d.pipeline_phase === 'prescribe' && d.execution_results);
      if (lastPrescription) {
        currentPhase = 'execute';
      }
    } else if (lastPhase === 'execute') {
      // Full cycle done — restart pipeline with fresh diagnostic
      currentPhase = 'diagnose';
    }

    console.log(`[Parménion] Domain: ${domain}, Cycle: ${cycle_number}, Phase: ${currentPhase}, LastPhase: ${lastPhase || 'none'}, IKtracker: ${isIktracker}`);

    // ═══ PHASE 1: Check error rate → conservative mode? ═══
    const { data: errorRateData } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    const conservativeMode = errorRateData?.conservative_mode === true;
    const maxRisk = conservativeMode ? MAX_RISK_CONSERVATIVE : MAX_RISK_NORMAL;

    // ═══ PHASE 2: Gather context ═══
    const [diagnosticsRes, cocoonRes, errorsRes, recoRegistryRes, auditRawRes] = await Promise.all([
      supabase.from('cocoon_diagnostic_results')
        .select('diagnostic_type, scores, findings, created_at')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(4),
      supabase.from('cocoon_sessions')
        .select('cluster_summary, nodes_count, clusters_count, intent_distribution, avg_geo_score, avg_eeat_score, avg_content_gap, avg_cannibalization_risk')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('parmenion_recent_errors', { p_domain: domain }),
      supabase.from('audit_recommendations_registry')
        .select('title, category, priority, fix_type, fix_data, is_resolved')
        .eq('domain', domain)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('audit_raw_data')
        .select('audit_type, raw_payload, source_functions, created_at')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const diagnostics = diagnosticsRes.data || [];
    const cocoon = cocoonRes.data;
    const pastErrors = errorsRes.data || [];
    const pendingRecommendations = recoRegistryRes.data || [];
    const rawAuditData = auditRawRes.data || [];

    // Collect execution results from previous phases in this pipeline run
    const previousPhaseResults = (lastCompletedDecisions || [])
      .filter(d => d.execution_results)
      .slice(0, 5)
      .map(d => ({
        phase: d.pipeline_phase,
        goal: d.goal_description,
        functions: d.functions_called,
        results: d.execution_results,
      }));

    // ═══ PHASE 3: LLM Decision ═══
    const decision = await askParmenionLLM({
      domain,
      cycle_number,
      currentPhase,
      conservativeMode,
      maxRisk,
      diagnostics,
      cocoon,
      pastErrors,
      previousPhaseResults,
      pendingRecommendations,
      rawAuditData,
      isIktracker,
    });

    if (!decision) {
      return new Response(JSON.stringify({ error: 'Parménion could not produce a decision' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ PHASE 4: Validate functions against phase ═══
    const allowedFunctions = [...PHASE_FUNCTIONS[currentPhase]];
    const validatedFunctions = decision.action.functions.filter((f: string) => allowedFunctions.includes(f));
    if (validatedFunctions.length === 0) {
      console.warn(`[Parménion] LLM chose invalid functions for phase ${currentPhase}:`, decision.action.functions);
      if (currentPhase === 'diagnose') validatedFunctions.push('audit-expert-seo');
      else if (currentPhase === 'prescribe') validatedFunctions.push('generate-corrective-code');
      else if (currentPhase === 'execute') validatedFunctions.push(isIktracker ? 'iktracker-actions' : 'wpsync');
    }
    decision.action.functions = validatedFunctions;

    // ═══ PHASE 5: Persist decision ═══
    const logEntry = {
      tracked_site_id,
      user_id: authUserId || bodyUserId || tracked_site_id,
      domain,
      cycle_number,
      pipeline_phase: currentPhase,
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
      pipeline_phase: currentPhase,
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
  tactic: { initial_scope: any; final_scope: any; scope_reductions: number; estimated_tokens: number; target_url?: string };
  prudence: { impact_level: string; risk_score: number; iterations: number; goal_changed: boolean; reasoning: string };
  action: { type: string; payload: any; functions: string[] };
  summary: string;
}

async function askParmenionLLM(context: {
  domain: string;
  cycle_number: number;
  currentPhase: PipelinePhase;
  conservativeMode: boolean;
  maxRisk: number;
  diagnostics: any[];
  cocoon: any;
  pastErrors: any[];
  previousPhaseResults: any[];
  pendingRecommendations: any[];
  rawAuditData: any[];
  isIktracker: boolean;
}): Promise<ParmenionDecision | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[Parménion] LOVABLE_API_KEY not configured');
    return null;
  }

  const errorHistory = context.pastErrors.length > 0
    ? `\n\nHISTORIQUE D'ERREURS (calibre ton risque en conséquence):\n${context.pastErrors.map((e: any) => 
        `- Cycle #${e.cycle_number}: risque estimé ${e.risk_predicted} → réel ${e.risk_calibrated}. Cause: ${e.calibration_note || 'inconnue'}.`
      ).join('\n')}`
    : '';

  const previousResults = context.previousPhaseResults.length > 0
    ? `\n\nRÉSULTATS DES PHASES PRÉCÉDENTES (utilise ces données pour ta décision):\n${context.previousPhaseResults.map(r => 
        `- Phase "${r.phase}" — ${r.goal}\n  Fonctions: ${r.functions?.join(', ')}\n  Résultats: ${JSON.stringify(r.results).slice(0, 2000)}`
      ).join('\n\n')}`
    : '';

  const pendingRecos = context.pendingRecommendations.length > 0
    ? `\n\nRECOMMANDATIONS EN ATTENTE D'APPLICATION (${context.pendingRecommendations.length}):\n${context.pendingRecommendations.slice(0, 10).map(r =>
        `- [${r.priority}] ${r.title} (${r.category}) — fix_type: ${r.fix_type || 'none'}${r.fix_data ? ' ✓ code disponible' : ''}`
      ).join('\n')}`
    : '';

  const rawData = context.rawAuditData.length > 0
    ? `\n\nDONNÉES D'AUDIT BRUTES DISPONIBLES:\n${context.rawAuditData.map(d =>
        `- ${d.audit_type} (${d.source_functions?.join(', ')}) — ${JSON.stringify(d.raw_payload).slice(0, 1000)}`
      ).join('\n')}`
    : '';

  // ═══ IKtracker-specific execute instructions ═══
  const iktrackerExecuteInstructions = `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR IKTRACKER)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER concrètement sur iktracker.fr via l'API CMS.
Fonction autorisée: iktracker-actions

## ACTIONS CMS CONCRÈTES DISPONIBLES
Tu DOIS choisir UNE ou PLUSIEURS de ces actions dans le payload:

### Modifier une page existante
action.payload = {
  "cms_actions": [
    { "action": "update-page", "page_key": "slug-de-la-page", "updates": { "title": "...", "meta_description": "...", "content": "..." } }
  ]
}

### Modifier un article existant (title, meta_description, content, excerpt)
action.payload = {
  "cms_actions": [
    { "action": "update-post", "slug": "slug-de-larticle", "updates": { "title": "...", "meta_description": "...", "content": "...", "excerpt": "..." } }
  ]
}

### Créer un nouvel article de blog
action.payload = {
  "cms_actions": [
    { "action": "create-post", "body": { "title": "...", "slug": "...", "content": "...", "excerpt": "...", "status": "published" } }
  ]
}

### Créer une nouvelle page
action.payload = {
  "cms_actions": [
    { "action": "create-page", "body": { "title": "...", "slug": "...", "content": "...", "meta_description": "..." } }
  ]
}

## RÈGLES SPÉCIFIQUES IKTRACKER
- Le contenu DOIT être pertinent pour le SEO et le domaine iktracker.fr (outils SEO, tracking, analytics)
- Utilise les résultats des diagnostics précédents pour décider QUOI modifier/créer
- Priorise: meta descriptions manquantes → titres non optimisés → contenu thin → nouveaux articles ciblant des content gaps
- Tu peux combiner plusieurs cms_actions dans un seul payload
- INTERDIT: supprimer des pages/articles, modifier du contenu qui fonctionne déjà bien
- Le champ "functions" doit contenir ["iktracker-actions"]`;

  const wpsyncExecuteInstructions = `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR LE SITE)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER via le CMS.
Fonction autorisée: wpsync
Le payload doit contenir:
- Les pages à modifier (URLs)
- Le code correctif à injecter (meta tags, schema, contenu, liens internes)
- Le mode de déploiement (update_post, update_meta, inject_schema)
IMPORTANT: C'est l'étape finale. Tu dois déployer, pas diagnostiquer ni prescrire.`;

  const phaseInstructions: Record<PipelinePhase, string> = {
    diagnose: `## PHASE ACTUELLE: DIAGNOSE
Tu dois lancer UN diagnostic pour identifier les problèmes concrets du site.
Fonctions autorisées: audit-expert-seo, cocoon-diag-content, cocoon-diag-semantic, cocoon-diag-structure, cocoon-diag-authority
Choisis la fonction la plus pertinente selon le contexte. Si aucun diagnostic n'a été fait, commence par audit-expert-seo.
Le résultat de ce diagnostic sera utilisé à la phase suivante pour générer des correctifs.`,

    prescribe: `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)
Les diagnostics sont terminés. Tu as les résultats ci-dessous.
Tu dois maintenant GÉNÉRER LE CODE CORRECTIF concret à appliquer.
Fonctions autorisées: cocoon-strategist, calculate-cocoon-logic, generate-corrective-code
- Si des recommandations avec fix_data existent déjà → passe directement à generate-corrective-code
- Sinon → utilise cocoon-strategist pour produire un plan, puis generate-corrective-code
Le payload doit contenir les URLs et les correctifs précis à appliquer.
IMPORTANT: Ne refais PAS de diagnostic. Les données sont là, utilise-les.`,

    execute: context.isIktracker ? iktrackerExecuteInstructions : wpsyncExecuteInstructions,
  };

  const systemPrompt = `Tu es Parménion, moteur d'exécution AUTONOME de l'autopilote Crawlers.fr. Tu NE RECOMMANDES PAS, tu AGIS.

${phaseInstructions[context.currentPhase]}

## RÈGLES ABSOLUES
1. Tu ne peux utiliser QUE les fonctions de la phase actuelle
2. Tu ne reviens JAMAIS en arrière dans le pipeline (diagnose → prescribe → execute)
3. Tu ne répètes JAMAIS une action déjà complétée avec succès
4. Tu utilises les résultats des phases précédentes comme INPUT, pas comme prétexte pour re-diagnostiquer
5. INTERDICTIONS: supprimer des pages, modifier la charte graphique

## PRUDENCE
- Impact: faible | modéré | neutre | avancé | très_avancé
- Risque: 1 à ${context.maxRisk} MAXIMUM${context.conservativeMode ? ' (MODE CONSERVATEUR — erreurs > 20%)' : ''}
- Si risque ≥ 4 → réduis le scope
${errorHistory}${previousResults}${pendingRecos}${rawData}

## FORMAT DE RÉPONSE (JSON strict, sans texte autour)
{
  "goal": { "type": "...", "cluster_id": "...", "description": "..." },
  "tactic": { "initial_scope": {...}, "final_scope": {...}, "scope_reductions": 0, "estimated_tokens": 0, "target_url": "..." },
  "prudence": { "impact_level": "...", "risk_score": 1, "iterations": 0, "goal_changed": false, "reasoning": "..." },
  "action": { "type": "...", "payload": {...}, "functions": ["..."] },
  "summary": "..."
}`;

  const userPrompt = `Domaine: ${context.domain}
Cycle: ${context.cycle_number}
Phase pipeline: ${context.currentPhase.toUpperCase()}
Mode conservateur: ${context.conservativeMode ? 'OUI' : 'NON'}
CMS cible: ${context.isIktracker ? 'IKtracker (API Supabase)' : 'WordPress (wpsync)'}

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

Quelle action concrète exécutes-tu pour la phase ${context.currentPhase.toUpperCase()} ?`;

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
            description: 'Submit Parménion autonomous action for this autopilot cycle',
            parameters: {
              type: 'object',
              properties: {
                goal: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['cluster_optimization', 'content_gap', 'linking', 'technical_fix', 'deployment', 'meta_optimization'] },
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
                    target_url: { type: 'string' },
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

    // Enforce risk ceiling
    if (decision.prudence.risk_score > context.maxRisk) {
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
