import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Parménion — Orchestrateur stratégique autonome pour Autopilot
 * 
 * Pipeline obligatoire en 5 phases:
 *   1. AUDIT: audit-expert-seo (audit technique pur)
 *   2. DIAGNOSE: cocoon-diag-* (diagnostic stratégique sémantique)
 *   3. PRESCRIBE: cocoon-strategist, calculate-cocoon-logic, generate-corrective-code
 *   4. EXECUTE: wpsync (WordPress) OU iktracker-actions (IKtracker)
 *   5. VALIDATE: re-crawl ciblé, comparaison avant/après
 * 
 * Chaque cycle avance d'une phase. Parménion ne recule jamais.
 * Les résultats de chaque phase alimentent la suivante.
 */

const MAX_RISK_NORMAL = 3;
const MAX_RISK_CONSERVATIVE = 2;

// Pipeline phases in strict order
const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;
// Note: 'route' is handled inline by the engine, not as a separate orchestrator phase
type PipelinePhase = typeof PIPELINE_PHASES[number];

const PHASE_FUNCTIONS: Record<PipelinePhase, string[]> = {
  audit: ['audit-expert-seo'],
  diagnose: ['cocoon-diag-content', 'cocoon-diag-semantic', 'cocoon-diag-structure', 'cocoon-diag-authority'],
  prescribe: ['cocoon-strategist', 'calculate-cocoon-logic', 'generate-corrective-code', 'content-architecture-advisor'],
  execute: ['wpsync', 'iktracker-actions', 'generate-corrective-code'],
  validate: ['audit-expert-seo', 'cocoon-diag-content'],
};

function isIktrackerDomain(domain: string): boolean {
  return domain.toLowerCase().includes('iktracker');
}

function getNextPhase(lastPhase: PipelinePhase | undefined): PipelinePhase {
  if (!lastPhase) return 'audit';
  const idx = PIPELINE_PHASES.indexOf(lastPhase);
  if (idx === -1 || idx >= PIPELINE_PHASES.length - 1) return 'audit'; // cycle complete → restart
  return PIPELINE_PHASES[idx + 1];
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

    const { tracked_site_id, domain, cycle_number = 1, user_id: bodyUserId, forced_phase } = await req.json();
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

    const lastPhase = (lastCompletedDecisions || [])[0]?.pipeline_phase as PipelinePhase | undefined;
    // Use forced_phase from engine if provided, otherwise auto-detect
    const currentPhase = (forced_phase && PIPELINE_PHASES.includes(forced_phase)) 
      ? (forced_phase as PipelinePhase) 
      : getNextPhase(lastPhase);

    console.log(`[Parménion] Domain: ${domain}, Cycle: ${cycle_number}, Phase: ${currentPhase}, LastPhase: ${lastPhase || 'none'}, IKtracker: ${isIktracker}`);

    // ═══ PHASE 1: Check error rate → conservative mode? ═══
    const { data: errorRateData } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    const conservativeMode = errorRateData?.conservative_mode === true;
    const maxRisk = conservativeMode ? MAX_RISK_CONSERVATIVE : MAX_RISK_NORMAL;

    // ═══ PHASE 2: Gather context ═══
    const [diagnosticsRes, cocoonRes, errorsRes, recoRegistryRes, auditRawRes, siteKeywordsRes, siteInfoRes] = await Promise.all([
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
      // Fetch the site's actual keyword universe from domain_data_cache
      supabase.from('domain_data_cache')
        .select('result_data')
        .eq('domain', domain)
        .eq('data_type', 'serp_kpis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Fetch site identity (market sector, business type)
      supabase.from('tracked_sites')
        .select('site_name, market_sector, business_type, client_targets, site_context')
        .eq('id', tracked_site_id)
        .maybeSingle(),
    ]);

    const diagnostics = diagnosticsRes.data || [];
    const cocoon = cocoonRes.data;
    const pastErrors = errorsRes.data || [];
    const pendingRecommendations = recoRegistryRes.data || [];
    const rawAuditData = auditRawRes.data || [];

    // Extract the site's keyword universe
    const siteKeywords: string[] = [];
    const serpKpis = (siteKeywordsRes as any)?.data?.result_data;
    if (serpKpis?.sample_keywords) {
      for (const kw of serpKpis.sample_keywords) {
        if (kw.keyword) siteKeywords.push(kw.keyword);
      }
    }
    const siteInfo = (siteInfoRes as any)?.data || null;

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
      siteKeywords,
      siteInfo,
    });

    if (!decision) {
      return new Response(JSON.stringify({ error: 'Parménion could not produce a decision' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ PHASE 4: Validate functions against phase ═══
    const allowedFunctions = [...PHASE_FUNCTIONS[currentPhase]];
    const validatedFunctions = decision.action.functions.filter((f: string) => allowedFunctions.includes(f));
    if (validatedFunctions.length === 0) {
      console.warn(`[Parménion] LLM chose invalid functions for phase ${currentPhase}:`, decision.action.functions);
      // Fallback to appropriate function for the phase
      if (currentPhase === 'audit') validatedFunctions.push('audit-expert-seo');
      else if (currentPhase === 'diagnose') validatedFunctions.push('cocoon-diag-content');
      else if (currentPhase === 'prescribe') {
        // Alternate between content and technical based on cycle parity
        // Odd cycles → content-architecture-advisor, Even → generate-corrective-code
        if (isIktracker && cycle_number % 2 === 1) {
          validatedFunctions.push('content-architecture-advisor');
        } else {
          validatedFunctions.push('generate-corrective-code');
        }
      }
      else if (currentPhase === 'execute') validatedFunctions.push(isIktracker ? 'iktracker-actions' : 'wpsync');
      else if (currentPhase === 'validate') validatedFunctions.push('audit-expert-seo');
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
  siteKeywords: string[];
  siteInfo: any;
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

  const phaseInstructions = buildPhaseInstructions(context);

  const systemPrompt = `Tu es Parménion, moteur d'exécution AUTONOME de l'autopilote Crawlers.fr. Tu NE RECOMMANDES PAS, tu AGIS.

${phaseInstructions}

## RÈGLES ABSOLUES
1. Tu ne peux utiliser QUE les fonctions de la phase actuelle
2. Tu ne reviens JAMAIS en arrière dans le pipeline (audit → diagnose → prescribe → execute → validate)
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

  const siteIdentityBlock = context.siteInfo
    ? `\nIDENTITÉ DU SITE:
Nom: ${context.siteInfo.site_name || context.domain}
Secteur: ${context.siteInfo.market_sector || 'Non défini'}
Type: ${context.siteInfo.business_type || 'Non défini'}
Cibles: ${context.siteInfo.client_targets || 'Non définies'}
Contexte: ${context.siteInfo.site_context || 'Non disponible'}`
    : '';

  const keywordsBlock = context.siteKeywords.length > 0
    ? `\nUNIVERS MOTS-CLÉS DU SITE (mots-clés sur lesquels le site se positionne réellement):
${context.siteKeywords.slice(0, 50).join(', ')}

⚠️ RÈGLE CRITIQUE: Tout contenu créé DOIT cibler un mot-clé pertinent pour cet univers sémantique. 
INTERDIT de créer du contenu sur un sujet hors de l'activité du site (ex: ne pas écrire sur le SEO pour un site de comptabilité).
Le mot-clé choisi dans le payload content-architecture-advisor DOIT être en rapport direct avec le secteur d'activité ci-dessus.`
    : '';

  const userPrompt = `Domaine: ${context.domain}
Cycle: ${context.cycle_number}
Phase pipeline: ${context.currentPhase.toUpperCase()}
Mode conservateur: ${context.conservativeMode ? 'OUI' : 'NON'}
CMS cible: ${context.isIktracker ? 'IKtracker (API Supabase)' : 'WordPress (wpsync)'}
${siteIdentityBlock}${keywordsBlock}

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
                    type: { type: 'string', enum: ['audit_technical', 'diagnostic_semantic', 'cluster_optimization', 'content_gap', 'content_creation', 'linking', 'technical_fix', 'deployment', 'meta_optimization', 'validation_post_deploy'] },
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

// ═══════════════════════════════════════════════════════════════
// PHASE INSTRUCTION BUILDER
// ═══════════════════════════════════════════════════════════════

function buildPhaseInstructions(context: {
  currentPhase: PipelinePhase;
  isIktracker: boolean;
}): string {
  switch (context.currentPhase) {
    case 'audit':
      return `## PHASE ACTUELLE: AUDIT (AUDIT TECHNIQUE)
Tu dois lancer un audit technique complet du site pour identifier les problèmes SEO techniques (performance, indexabilité, erreurs HTTP, structure).
Fonction autorisée: audit-expert-seo
Cet audit fournira les données brutes nécessaires aux diagnostics stratégiques de la phase suivante.
IMPORTANT: C'est un scan technique pur. Ne fais PAS de recommandations stratégiques ici.`;

    case 'diagnose':
      return `## PHASE ACTUELLE: DIAGNOSE (DIAGNOSTIC STRATÉGIQUE)
L'audit technique est terminé. Tu as les résultats ci-dessous.
Tu dois maintenant lancer UN diagnostic stratégique pour analyser la sémantique, le contenu, la structure ou l'autorité du site.
Fonctions autorisées: cocoon-diag-content, cocoon-diag-semantic, cocoon-diag-structure, cocoon-diag-authority
Choisis la fonction la plus pertinente selon les problèmes révélés par l'audit technique.
IMPORTANT: Ne refais PAS d'audit technique. Les données sont là, utilise-les pour choisir le bon diagnostic.`;

    case 'prescribe':
      return `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)
Les audits et diagnostics sont terminés. Tu as les résultats ci-dessous.
Tu dois maintenant GÉNÉRER LE CODE CORRECTIF concret à appliquer.
Fonctions autorisées: cocoon-strategist, calculate-cocoon-logic, generate-corrective-code, content-architecture-advisor

## RÈGLE CRITIQUE DE PERTINENCE THÉMATIQUE
⚠️ Le mot-clé ("keyword") choisi pour content-architecture-advisor DOIT être en rapport DIRECT avec l'activité du site.
- Consulte l'UNIVERS MOTS-CLÉS DU SITE ci-dessus pour choisir un mot-clé pertinent
- Si le site est sur les "indemnités kilométriques", le keyword doit concerner les frais de déplacement, la fiscalité auto, etc. — PAS le SEO, le marketing, ou tout autre sujet hors secteur
- Le contenu créé doit répondre aux questions que les CLIENTS du site se posent, pas aux questions techniques du webmaster
- En cas de doute, utilise un mot-clé issu directement de la liste de mots-clés fournie dans le contexte

## DEUX TYPES DE PRESCRIPTIONS

### TYPE A: Correctifs techniques (meta, performance, schema)
→ Utilise generate-corrective-code
→ Payload: tableau "fixes" avec id, label, category, prompt, enabled, target_url

### TYPE B: Création de contenu (multi-objectifs)
→ Utilise content-architecture-advisor pour générer l'architecture du contenu
→ Payload ENRICHI:
{
  "url": "https://domain.tld",
  "keyword": "mot-clé-cible PERTINENT pour le secteur du site",
  "page_type": "article",
  "tracked_site_id": "...",
  "page_type": "article",
  "tracked_site_id": "...",
  "strategic_objectives": [
    { "type": "content_gap", "description": "Combler le gap sur X", "priority": "high", "related_keywords": ["kw1", "kw2"] },
    { "type": "internal_linking", "description": "Renforcer le maillage vers /page-A et /page-B", "priority": "high", "related_urls": ["https://domain.tld/page-A"] },
    { "type": "eeat_improvement", "description": "Démontrer l'expertise sur le sujet Y", "priority": "medium" },
    { "type": "silo_rebalance", "description": "Rééquilibrer le cluster Z", "priority": "medium" },
    { "type": "cannibalization_fix", "description": "Différencier de /page-C qui cannibalise le mot-clé W", "priority": "high" }
  ],
  "target_internal_links": [
    { "url": "https://domain.tld/page-cible", "anchor_text": "texte d'ancre suggéré", "reason": "page pilier du silo" }
  ],
  "cannibalization_data": [
    { "keyword": "mot-clé cannibalisé", "competing_urls": ["https://domain.tld/page-A", "https://domain.tld/page-B"], "severity": "high" }
  ],
  "silo_context": {
    "cluster_name": "Nom du cluster",
    "existing_pages": ["https://domain.tld/p1", "https://domain.tld/p2"],
    "gap_description": "Description du trou dans le silo"
  }
}

RÈGLES POUR CONSTRUIRE LE PAYLOAD:
1. Un contenu doit TOUJOURS servir AU MOINS 2 objectifs stratégiques (ex: gap + maillage, ou nouveau mot-clé + E-E-A-T)
2. Utilise les données du cocon sémantique pour remplir target_internal_links avec les URLs concrètes des pages du cluster
3. Si le diagnostic révèle une cannibalisation, INCLUS les données dans cannibalization_data
4. Si le contenu s'inscrit dans un silo, INCLUS le silo_context avec les pages existantes
5. Priorise les gaps qui renforcent le maillage interne existant (combler des trous entre clusters)

## FORMAT OBLIGATOIRE DU PAYLOAD POUR generate-corrective-code
Le payload DOIT contenir un tableau "fixes" avec ce format exact:
{
  "fixes": [
    {
      "id": "fix-unique-id",
      "label": "Description courte du correctif",
      "category": "seo|performance|strategic|accessibility",
      "prompt": "Instructions détaillées pour le LLM générateur: ce qu'il doit corriger, où, et comment",
      "enabled": true,
      "target_url": "https://domain.tld/page-cible (optionnel)"
    }
  ]
}
SANS ce tableau "fixes", l'appel ÉCHOUERA. Génère au moins 1 fix basé sur les diagnostics.

IMPORTANT: Ne refais PAS de diagnostic. Les données sont là, utilise-les.`;

    case 'execute':
      return context.isIktracker ? buildIktrackerExecuteInstructions() : buildWpsyncExecuteInstructions();

    case 'validate':
      return `## PHASE ACTUELLE: VALIDATE (VÉRIFICATION POST-DÉPLOIEMENT)
Les correctifs ont été déployés sur le CMS. Tu dois maintenant VÉRIFIER que les changements sont bien appliqués et mesurer l'impact initial.
Fonctions autorisées: audit-expert-seo, cocoon-diag-content

Tu dois:
1. Lancer un audit-expert-seo ciblé sur les URLs modifiées pour vérifier que les correctifs sont en place
2. OU lancer un cocoon-diag-content pour mesurer l'amélioration du score de contenu

Le payload doit inclure:
- Les URLs ciblées par l'exécution précédente (disponibles dans les résultats des phases précédentes)
- Le type de vérification: "post_deploy_check"

Dans ton goal, utilise le type "validation_post_deploy".
Dans ton summary, compare les métriques avant/après si disponibles.

IMPORTANT: C'est une vérification READ-ONLY. Tu ne modifies RIEN. Tu constates et tu mesures.
Si la validation échoue (correctifs non appliqués), signale-le dans le reasoning avec un risk_score élevé.`;
  }
}

function buildIktrackerExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR IKTRACKER)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER concrètement.

## IMPORTANT: CHOISIS LE BON CANAL DE DÉPLOIEMENT

Tu as DEUX canaux possibles. Choisis selon le TYPE de correctif:

### CANAL 1: CMS CRUD (iktracker-actions)
Pour: modifier title, meta_description, contenu de page/article, créer des articles/pages.
→ functions: ["iktracker-actions"]
→ payload DOIT contenir "cms_actions": [...]

### CANAL 2: JS Injectable (generate-corrective-code)
Pour: scripts techniques (lazy loading, CLS fixes, schema JSON-LD, optimisations performance, etc.)
→ functions: ["generate-corrective-code"]
→ payload DOIT contenir "fixes": [{ "id": "...", "label": "...", "category": "...", "prompt": "...", "enabled": true }]
→ Le code généré sera injecté via site_script_rules, PAS via le CMS

## RÈGLE CRITIQUE
- Si tes correctifs sont du contenu (texte, méta, articles) → CANAL 1 (iktracker-actions + cms_actions)
- Si tes correctifs sont du code technique (JS, performance, schema) → CANAL 2 (generate-corrective-code + fixes)
- NE METS JAMAIS iktracker-actions dans functions si tu n'as pas de cms_actions concrètes
- Tu peux utiliser LES DEUX canaux en parallèle si tu as les deux types de correctifs

## CHAMPS DISPONIBLES SUR IKTRACKER

### Champs PAGES (create-page / update-page)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre affiché de la page |
| meta_title | string | Balise <title> SEO (si différent du title) |
| meta_description | string | Meta description SEO |
| content | object/string | Contenu HTML de la page |
| canonical_url | string | URL canonique (si cross-posting ou duplicate) |
| schema_org | object | Données structurées JSON-LD (FAQPage, HowTo, etc.) |
| page_key | string | Identifiant unique / slug de la page |

### Champs POSTS (create-post / update-post)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre de l'article |
| slug | string | URL slug en kebab-case sans accents |
| content | string | Contenu HTML complet et riche |
| excerpt | string | Résumé court affiché en listing/cards (2-3 phrases) |
| meta_description | string | Meta description SEO (max 160 chars) |
| meta_title | string | Balise <title> SEO si différent du title |
| status | string | TOUJOURS "draft" — JAMAIS "published" |
| author_name | string | Nom de l'auteur affiché (ex: "Équipe IKtracker") |
| image_url | string | URL de l'image à la une (hero image) |
| category | string | Catégorie de l'article (ex: "Guides", "Actualités", "Conseils fiscaux") |
| tags | string[] | Tags/mots-clés associés |
| canonical_url | string | URL canonique si republication |
| schema_org | object | Données structurées JSON-LD (Article, BlogPosting, FAQPage) |

## ACTIONS CMS CONCRÈTES (CANAL 1 uniquement)

### Modifier une page existante
{ "action": "update-page", "page_key": "slug-de-la-page", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "canonical_url": "...", "schema_org": {...} } }

### Modifier un article existant
{ "action": "update-post", "slug": "slug-de-larticle", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "excerpt": "...", "author_name": "...", "image_url": "...", "category": "...", "tags": [...], "schema_org": {...} } }

### Créer un nouvel article de blog (TOUJOURS EN BROUILLON)
{ "action": "create-post", "body": { "title": "...", "slug": "...", "content": "...", "excerpt": "...", "status": "draft", "meta_description": "...", "meta_title": "...", "author_name": "Équipe IKtracker", "category": "...", "tags": ["...", "..."], "schema_org": { "@context": "https://schema.org", "@type": "BlogPosting", "headline": "...", "description": "...", "author": { "@type": "Organization", "name": "IKtracker" } } } }

### Créer une nouvelle page
{ "action": "create-page", "body": { "title": "...", "page_key": "...", "content": "...", "meta_title": "...", "meta_description": "...", "schema_org": {...} } }

## RÈGLES POUR LA CRÉATION DE CONTENU (create-post)
Quand tu crées un article pour combler un gap de contenu:
1. Le contenu DOIT être du HTML complet et riche (pas du texte brut) avec :
   - Des titres H2/H3 bien structurés
   - Des paragraphes de 3-4 phrases max
   - Des listes à puces ou numérotées quand pertinent
   - Un chapô introductif en gras
2. Le contenu DOIT inclure des LIENS INTERNES concrets sous forme <a href="https://iktracker.fr/chemin">ancre</a>
   - Utilise les URLs existantes du site trouvées dans les diagnostics et le cocon sémantique
   - Vise 3 à 5 liens internes par article, vers les pages stratégiquement liées
   - Les ancres doivent être naturelles et descriptives (pas "cliquez ici")
3. Inclus 1-2 liens EXTERNES vers des sources de référence si pertinent (documentation officielle, études)
4. Rédige un excerpt ET une meta_description — ce sont DEUX champs distincts:
   - excerpt: résumé affiché en listing (2-3 phrases, engageant)
   - meta_description: optimisé SEO (max 160 chars, avec mot-clé principal)
5. Le status DOIT être "draft" — JAMAIS "published". L'utilisateur validera manuellement.
6. Le slug doit être court, en kebab-case, sans accents
7. Longueur cible: 800-1500 mots minimum
8. TOUJOURS remplir: title, slug, content, excerpt, meta_description, status, author_name, category
9. ⚠️ INDEXABILITÉ : Le contenu HTML DOIT inclure en tout début une balise meta robots indexable:
   <meta name="robots" content="index, follow">
   ET dans le schema_org, ajoute "isAccessibleForFree": true
10. Si pertinent, ajouter: meta_title (si différent du title), tags, schema_org (BlogPosting)
11. author_name par défaut: "Équipe IKtracker"

## RÈGLES SPÉCIFIQUES IKTRACKER
- Le contenu DOIT être pertinent pour l'activité du site. Consulte l'UNIVERS MOTS-CLÉS et l'IDENTITÉ DU SITE fournis dans le contexte.
- Pour IKtracker spécifiquement: indemnités kilométriques, frais réels, gestion de trajets, fiscalité auto-entrepreneur
- INTERDIT de créer du contenu hors-sujet (ex: article sur le SEO, le marketing digital, ou tout autre sujet non lié à l'activité du site)
- Utilise les résultats des diagnostics précédents pour décider QUOI modifier/créer
- Priorise: meta descriptions manquantes → titres non optimisés → contenu thin → nouveaux articles ciblant des content gaps
- Diversifie les actions: mélange modifications de pages existantes ET création de nouveaux contenus quand c'est pertinent
- INTERDIT: supprimer des pages/articles, modifier du contenu qui fonctionne déjà bien
- INTERDIT: publier directement un article (toujours draft)
- Catégories suggérées: "Guides", "Actualités", "Conseils fiscaux", "Comparatifs", "Tutoriels"
- Tags pertinents: "indemnités kilométriques", "frais réels", "barème IK", "déclaration impôts", "auto-entrepreneur", "trajets professionnels"`;
}

function buildWpsyncExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR LE SITE)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER via le CMS.
Fonction autorisée: wpsync
Le payload doit contenir:
- Les pages à modifier (URLs)
- Le code correctif à injecter (meta tags, schema, contenu, liens internes)
- Le mode de déploiement (update_post, update_meta, inject_schema)
IMPORTANT: C'est l'étape finale de déploiement. Tu dois déployer, pas diagnostiquer ni prescrire.`;
}

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler);
}
