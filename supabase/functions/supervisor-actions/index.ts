import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAgentContext } from '../_shared/getAgentContext.ts';
import { CostAccumulator } from '../_shared/llmCostCalculator.ts';

// ─── Kill switch check ───────────────────────────────────────────────
async function isSupervisorEnabled(): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'supervisor_enabled')
    .single()
  return data?.value?.enabled === true
}

// ─── Collect CTO corrective actions (approved/deployed) ─────────────
async function collectCtoCorrections(supabase: any): Promise<any[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('cto_agent_logs')
    .select('*')
    .in('decision', ['approved', 'needs_review'])
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(40)

  return (logs || []).map((log: any) => ({
    id: log.id,
    function_analyzed: log.function_analyzed,
    decision: log.decision,
    confidence: log.confidence_score,
    analysis_summary: log.analysis_summary,
    self_critique: log.self_critique,
    proposed_change: log.proposed_change,
    change_diff_pct: log.change_diff_pct,
    prompt_version_before: log.prompt_version_before,
    prompt_version_after: log.prompt_version_after,
    metadata: log.metadata,
    date: log.created_at,
  }))
}

// ─── Read deployed function source from system_config ────────────────
async function readFunctionSource(supabase: any, functionName: string): Promise<string> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', `function_source:${functionName}`)
    .single()

  if (data?.value?.source) return data.value.source

  // Fallback: try the legacy cto_function_source key
  if (functionName === 'agent-cto') {
    const { data: legacy } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'cto_function_source')
      .single()
    return legacy?.value?.source || ''
  }

  return ''
}

// ─── Post-deployment error check for modified functions ──────────────
async function getPostDeployErrors(supabase: any, functionNames: string[]): Promise<any[]> {
  if (!functionNames.length) return []
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('analytics_events')
    .select('*')
    .in('event_type', ['edge_function_error', 'error', 'silent_error'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(200)

  // Filter to only errors mentioning one of the modified functions
  return (data || []).filter((evt: any) => {
    const fn = evt.event_data?.function_name || evt.url || ''
    return functionNames.some(name => fn.includes(name))
  })
}

// ─── Fetch patch effectiveness data ─────────────────────────────────
async function fetchPatchEffectiveness(supabase: any, days = 30): Promise<any[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('patch_effectiveness')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

function buildPatchEffectivenessContext(patches: any[]): string {
  if (!patches.length) return ''
  const effective = patches.filter((p: any) => p.is_effective)
  const ineffective = patches.filter((p: any) => !p.is_effective)
  const rate = Math.round((effective.length / patches.length) * 100)
  
  let ctx = `\n\n## 📊 HISTORIQUE PATCH EFFECTIVENESS (${patches.length} mesurés, taux efficacité: ${rate}%)\n`
  
  if (ineffective.length > 0) {
    ctx += `⚠️ Patchs INEFFICACES (${ineffective.length}) :\n`
    for (const p of ineffective.slice(0, 8)) {
      ctx += `  - ${p.target_function} [${p.agent_source}]: erreurs ${p.errors_before}→${p.errors_after} (${p.error_reduction_pct}%) — déployé ${p.deployment_date?.substring(0, 10) || 'N/A'}\n`
    }
  }
  if (effective.length > 0) {
    ctx += `✅ Patchs EFFICACES (${effective.length}) :\n`
    for (const p of effective.slice(0, 5)) {
      ctx += `  - ${p.target_function} [${p.agent_source}]: erreurs ${p.errors_before}→${p.errors_after} (${p.error_reduction_pct}%)\n`
    }
  }
  return ctx
}


// ─── AI: Audit SAV Assistant quality ─────────────────────────────────
async function auditAssistantQuality(supabase: any): Promise<any> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: scores } = await supabase
    .from('sav_quality_scores')
    .select('*')
    .gte('scored_at', sevenDaysAgo)
    .order('scored_at', { ascending: false })
    .limit(100)

  const { data: convos } = await supabase
    .from('sav_conversations')
    .select('id, messages, phone_callback, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(50)

  const totalConvos = (convos || []).length
  const avgScore = (scores || []).length > 0
    ? Math.round((scores || []).reduce((s: number, q: any) => s + (q.precision_score || 0), 0) / scores.length)
    : null
  const escalations = (scores || []).filter((s: any) => s.escalated_to_phone).length
  const repeatedIntents = (scores || []).filter((s: any) => s.repeated_intent_count > 0).length
  const routeMatches = (scores || []).filter((s: any) => s.route_match === true).length

  return {
    period: '7 days',
    total_conversations: totalConvos,
    scored_conversations: (scores || []).length,
    avg_precision_score: avgScore,
    escalation_rate: totalConvos > 0 ? Math.round((escalations / totalConvos) * 100) : 0,
    repeated_intent_rate: (scores || []).length > 0 ? Math.round((repeatedIntents / (scores || []).length) * 100) : 0,
    route_match_rate: (scores || []).length > 0 ? Math.round((routeMatches / (scores || []).length) * 100) : 0,
    status: avgScore === null ? 'no_data' : avgScore >= 70 ? 'healthy' : avgScore >= 40 ? 'needs_attention' : 'critical',
  }
}

// ─── AI: Audit CTO corrections quality & impact ─────────────────────
async function auditCorrections(corrections: any[], functionSources: Record<string, string>, postErrors: any[], operationalContext?: string): Promise<any> {
  const systemPrompt = `Tu es le SUPERVISOR, un auditeur qualité des corrections déployées par l'Agent CTO.

TON RÔLE (NOUVEAU) :
Tu ne cherches PAS les erreurs. Tu audites les SOLUTIONS que le CTO a déployées :
1. Analyser chaque action corrective du CTO (approved/deployed)
2. Lire le code source de la fonction modifiée
3. Évaluer la QUALITÉ de la solution : logique, robustesse, edge cases, impact sur les performances
4. Vérifier si des erreurs post-déploiement sont apparues sur ces fonctions (régression)
5. Noter le ratio bénéfice/risque de chaque correction

CE QUE TU AUDITES PAR CORRECTION :
- La logique du changement est-elle correcte ?
- Y a-t-il des edge cases non gérés ?
- Le changement peut-il causer des régressions ?
- L'impact sur les performances est-il acceptable ?
- Le code respecte-t-il les patterns existants ?
- Des erreurs sont-elles apparues APRÈS le déploiement de cette correction ?

RÈGLES CRITIQUES DE NOTATION :
- VERT (🟢) : correction saine, bien implémentée, pas de risque
- ORANGE (🟠) : correction fonctionnelle mais avec des réserves (edge cases, perf, etc.)
- Le ROUGE est INTERDIT. Si un problème semble critique, tu DOIS proposer un correctif intermédiaire qui ramène le risque à ORANGE

FORMAT DE RÉPONSE (JSON strict) :
{
  "summary": "Vue d'ensemble de la qualité des corrections CTO sur la période",
  "corrections_audited": [
    {
      "cto_log_id": "id du log CTO",
      "function": "nom de la fonction modifiée",
      "cto_intent": "Ce que le CTO voulait corriger",
      "solution_quality": "green" | "orange",
      "logic_assessment": "Évaluation de la logique du code déployé",
      "edge_cases": ["Edge case non géré 1", ...],
      "performance_impact": "Impact estimé sur la perf",
      "regression_detected": true | false,
      "regression_details": "Détail si des erreurs post-deploy existent",
      "improvement_suggestion": "Suggestion d'amélioration si orange, null si green"
    }
  ],
  "overall_cto_score": "Score global sur 100 de la qualité des corrections CTO",
  "patterns_observed": ["Patterns récurrents dans les corrections (bons ou mauvais)"],
  "strategic_recommendations": ["Recommandations stratégiques pour le CTO"]
}`

  const correctionsData = JSON.stringify(corrections.slice(0, 20), null, 2)
  const sourcesData = Object.entries(functionSources)
    .map(([name, src]) => `=== ${name} ===\n${(src || '').substring(0, 4000)}`)
    .join('\n\n')
  const errorsData = JSON.stringify(postErrors.slice(0, 30), null, 2)

  const userPrompt = `ACTIONS CORRECTIVES DU CTO (30 derniers jours, approuvées/déployées) :
\`\`\`json
${correctionsData}
\`\`\`

CODE SOURCE DES FONCTIONS MODIFIÉES :
\`\`\`typescript
${sourcesData.substring(0, 12000)}
\`\`\`

ERREURS POST-DÉPLOIEMENT sur ces fonctions (7 derniers jours) :
\`\`\`json
${errorsData}
\`\`\`
${operationalContext || ''}

Audite chaque correction : logique, impact, régressions. Note chaque correction en vert/orange.
Rappel : JAMAIS de rouge — propose un correctif intermédiaire si nécessaire.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crawlers.fr',
      'X-Title': 'Crawlers Supervisor',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.15,
      max_tokens: 6000,
    }),
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Enforce: no red ratings
      if (parsed.corrections_audited) {
        for (const c of parsed.corrections_audited) {
          if (c.solution_quality === 'red') {
            c.solution_quality = 'orange'
            c.improvement_suggestion = `[FORCÉ EN ORANGE] ${c.improvement_suggestion || 'Le Supervisor recommande un correctif intermédiaire'}`
          }
        }
      }
      return parsed
    }
  } catch (e) {
    console.error('[SUPERVISOR] Parse error:', e)
  }

  return {
    summary: 'Erreur d\'analyse',
    corrections_audited: [],
    overall_cto_score: 0,
    patterns_observed: [],
    strategic_recommendations: [],
    raw_response: content.substring(0, 500),
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
try {
    // Check kill switch
    const enabled = await isSupervisorEnabled()
    if (!enabled) {
      return jsonOk({ success: false, reason: 'Supervisor désactivé' })
    }

    // Auth check - admin only
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Unauthorized', 401)
    }

    const supabase = getServiceClient()
    
    // Verify admin role
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData?.user) {
      return jsonError('Unauthorized', 401)
    }
    
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .single()
    
    if (!roleData) {
      return jsonError('Admin access required', 403)
    }

    const body = await req.json()
    const { action } = body

    // ─── Action: List CTO corrections ────────────────────────────
    if (action === 'list_corrections') {
      const corrections = await collectCtoCorrections(supabase)
      return jsonOk({ success: true, corrections, count: corrections.length })
    }

    // ─── Action: Audit CTO corrections ───────────────────────────
    if (action === 'analyze') {
      const corrections = await collectCtoCorrections(supabase)

      if (!corrections.length) {
        return new Response(JSON.stringify({
          success: true,
          analysis: {
            summary: 'Aucune action corrective CTO à auditer sur les 30 derniers jours.',
            corrections_audited: [],
            overall_cto_score: 100,
            patterns_observed: [],
            strategic_recommendations: [],
          },
          correction_count: 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Extract unique function names modified by CTO
      const functionNames = [...new Set(corrections.map((c: any) => c.function_analyzed).filter(Boolean))]

      // Read source code for each modified function + check post-deploy errors + enriched context + patch effectiveness
      const [functionSources, postErrors, agentContext, patchHistory] = await Promise.all([
        Promise.all(functionNames.map(async (name: string) => {
          const src = await readFunctionSource(supabase, name)
          return [name, src] as [string, string]
        })).then(entries => Object.fromEntries(entries)),
        getPostDeployErrors(supabase, functionNames as string[]),
        getAgentContext({ agent: 'supervisor', days: 7 }).catch(() => null),
        fetchPatchEffectiveness(supabase, 30),
      ])

      const patchContext = buildPatchEffectivenessContext(patchHistory)
      const fullContext = (agentContext?.promptSnippet || '') + patchContext
      const analysis = await auditCorrections(corrections, functionSources, postErrors, fullContext)

      // Log into supervisor_logs (NOT cto_agent_logs)
      await supabase.from('supervisor_logs').insert({
        audit_id: `supervisor_audit_${Date.now()}`,
        analysis_summary: analysis.summary || '',
        self_critique: `Score CTO: ${analysis.overall_cto_score || 'N/A'}/100`,
        confidence_score: 0,
        decision: 'needs_review',
        cto_score: analysis.overall_cto_score || 0,
        correction_count: corrections.length,
        functions_audited: functionNames,
        post_deploy_errors: postErrors.length,
        metadata: {
          type: 'correction_audit',
          cto_score: analysis.overall_cto_score,
        },
      })

      return jsonOk({
        success: true,
        analysis,
        correction_count: corrections.length,
        functions_audited: functionNames,
        post_deploy_errors: postErrors.length,
      })
    }

    // ─── Action: Audit SAV Assistant quality ─────────────────────
    if (action === 'audit_assistant') {
      const assistantReport = await auditAssistantQuality(supabase)

      // Log into supervisor_logs
      await supabase.from('supervisor_logs').insert({
        audit_id: `supervisor_assistant_${Date.now()}`,
        analysis_summary: `Assistant SAV — Score moyen: ${assistantReport.avg_precision_score ?? 'N/A'}/100, ${assistantReport.total_conversations} conversations, ${assistantReport.escalation_rate}% escalade`,
        self_critique: `Status: ${assistantReport.status}`,
        confidence_score: 0,
        decision: assistantReport.status === 'critical' ? 'needs_review' : 'approved',
        cto_score: assistantReport.avg_precision_score || 0,
        correction_count: assistantReport.scored_conversations,
        functions_audited: ['sav-agent'],
        post_deploy_errors: 0,
        metadata: { type: 'assistant_audit', ...assistantReport },
      })

      return jsonOk({ success: true, assistant_report: assistantReport })
    }

    // ─── Action: Audit Parménion (Autopilot) errors ──────────────
    if (action === 'audit_parmenion') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch recent Parménion decision logs
      const [decisionsRes, errorRateRes] = await Promise.all([
        supabase
          .from('parmenion_decision_log')
          .select('*')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.rpc('parmenion_error_rate', { p_domain: body.domain || '%', p_last_n: 20 }),
      ])

      const decisions = decisionsRes.data || []
      const errorRate = errorRateRes.data || { total: 0, errors: 0, error_rate: 0, conservative_mode: false }
      
      const errors = decisions.filter((d: any) => d.is_error === true)
      const completedCycles = decisions.filter((d: any) => d.status === 'completed')
      const highRiskActions = decisions.filter((d: any) => (d.risk_predicted || 0) >= 4)

      // Build LLM audit prompt
      const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
      const parmenionPrompt = `Tu es le SUPERVISOR. Tu audites les décisions de l'intelligence Parménion (pilote automatique SEO).

STATISTIQUES :
- Décisions analysées : ${decisions.length} (30 derniers jours)
- Erreurs d'appréciation : ${errors.length} (${errorRate.error_rate}%)
- Mode conservateur actif : ${errorRate.conservative_mode ? 'OUI' : 'NON'}
- Actions à haut risque (≥4) : ${highRiskActions.length}
- Cycles complétés : ${completedCycles.length}

ERREURS RÉCENTES :
${JSON.stringify(errors.slice(0, 10).map((e: any) => ({
  cycle: e.cycle_number,
  goal: e.goal_description,
  action: e.action_type,
  risk_predicted: e.risk_predicted,
  risk_calibrated: e.risk_calibrated,
  impact_predicted: e.impact_predicted,
  impact_actual: e.impact_actual,
  calibration_note: e.calibration_note,
  error_category: e.error_category,
})), null, 2)}

DÉCISIONS HAUTE RISQUE :
${JSON.stringify(highRiskActions.slice(0, 10).map((d: any) => ({
  cycle: d.cycle_number,
  goal: d.goal_description,
  action: d.action_type,
  risk: d.risk_predicted,
  status: d.status,
  is_error: d.is_error,
})), null, 2)}

Audite la qualité des décisions Parménion. Identifie les patterns d'erreur, les biais, et les recommandations stratégiques.

Réponds en JSON :
{
  "summary": "Vue d'ensemble de la qualité décisionnelle Parménion",
  "error_patterns": ["Pattern 1", ...],
  "risk_calibration_quality": "Score 0-100 sur la qualité de calibration du risque",
  "conservative_mode_justified": true/false,
  "strategic_recommendations": ["Reco 1", ...],
  "overall_score": 0-100,
  "severity": "healthy|needs_attention|critical"
}`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.fr',
          'X-Title': 'Crawlers Supervisor',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: 'Tu es le Supervisor de Crawlers. Tu audites la qualité des décisions de l\'intelligence Parménion.' },
            { role: 'user', content: parmenionPrompt },
          ],
          temperature: 0.15,
          max_tokens: 4000,
        }),
      })

      const llmData = await response.json()
      const content = llmData.choices?.[0]?.message?.content || ''

      let analysis: any = null
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0])
      } catch { /* ignore */ }

      // Log into supervisor_logs
      await supabase.from('supervisor_logs').insert({
        audit_id: `supervisor_parmenion_${Date.now()}`,
        analysis_summary: analysis?.summary || `Audit Parménion — ${errors.length} erreurs sur ${decisions.length} décisions`,
        self_critique: `Score: ${analysis?.overall_score || 'N/A'}/100, Taux d'erreur: ${errorRate.error_rate}%`,
        confidence_score: 0,
        decision: analysis?.severity === 'critical' ? 'needs_review' : 'approved',
        cto_score: analysis?.overall_score || 0,
        correction_count: decisions.length,
        functions_audited: ['parmenion', 'autopilot-engine'],
        post_deploy_errors: errors.length,
        metadata: {
          type: 'parmenion_audit',
          error_rate: errorRate,
          analysis,
          high_risk_count: highRiskActions.length,
        },
      })

      return new Response(JSON.stringify({
        success: true,
        parmenion_report: {
          total_decisions: decisions.length,
          errors: errors.length,
          error_rate: errorRate,
          high_risk_actions: highRiskActions.length,
          analysis,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: Toggle kill switches ────────────────────────────
    if (action === 'toggle_killswitch') {
      const { target, enabled: newState } = body
      if (!['supervisor_enabled', 'cto_agent_enabled'].includes(target)) {
        return jsonError('Invalid target', 400)
      }

      await supabase
        .from('system_config')
        .upsert({
          key: target,
          value: { enabled: newState },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      return jsonOk({ success: true, target, enabled: newState })
    }

    // ─── Action: Review a specific CTO code proposal ───────────
    if (action === 'review_cto_proposal') {
      const { proposal_id } = body
      if (!proposal_id) return jsonError('proposal_id required', 400)

      // 1. Fetch the CTO proposal
      const { data: proposal, error: propError } = await supabase
        .from('cto_code_proposals')
        .select('*')
        .eq('id', proposal_id)
        .single()

      if (propError || !proposal) {
        return jsonError('Proposition non trouvée', 404)
      }

      // 2. Read current source of the target function
      const currentSource = await readFunctionSource(supabase, proposal.target_function)

      // 3. Build Claude prompt for code review + patch
      const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
      const reviewPrompt = `Tu es le SUPERVISOR, un architecte logiciel senior chargé d'auditer le code produit par l'agent CTO.

CONTEXTE :
- Fonction cible : ${proposal.target_function}
- Domaine : ${proposal.domain}
- Type : ${proposal.proposal_type}
- Titre CTO : ${proposal.title}
- Description CTO : ${proposal.description || 'N/A'}
- Confiance CTO : ${proposal.confidence_score}%

CODE ORIGINAL (actuel en production) :
\`\`\`typescript
${(currentSource || proposal.original_code || 'Non disponible').substring(0, 8000)}
\`\`\`

CODE PROPOSÉ PAR LE CTO :
\`\`\`typescript
${(proposal.proposed_code || 'Non disponible').substring(0, 8000)}
\`\`\`

DIFF PREVIEW CTO :
${(proposal.diff_preview || 'Non disponible').substring(0, 4000)}

TA MISSION :
1. Audite le code proposé par le CTO : logique, edge cases, performance, sécurité, régressions
2. Si des problèmes sont détectés, propose un PATCH CORRECTIF (version améliorée du code CTO)
3. Si le code est bon, indique-le clairement

Réponds en JSON strict :
{
  "verdict": "approve" | "patch",
  "quality_score": <0-100>,
  "issues_found": ["issue 1", ...],
  "security_concerns": ["concern 1", ...],
  "edge_cases_missed": ["edge case 1", ...],
  "performance_notes": "impact perf estimé",
  "patch_code": "<code corrigé complet si verdict=patch, null si approve>",
  "patch_diff_summary": "<résumé des modifications apportées au code CTO>",
  "patch_rationale": "<justification détaillée du patch>",
  "supervisor_confidence": <0-100>
}`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.fr',
          'X-Title': 'Crawlers Supervisor',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: 'Tu es le Supervisor de Crawlers. Tu audites et corriges le code produit par l\'agent CTO. Tu es rigoureux, conservateur et factuel.' },
            { role: 'user', content: reviewPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        }),
      })

      const llmData = await response.json()
      const content = llmData.choices?.[0]?.message?.content || ''

      let review: any = null
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) review = JSON.parse(jsonMatch[0])
      } catch { /* ignore */ }

      if (!review) {
        return jsonError('Échec de l\'analyse Supervisor', 500)
      }

      // 4. If verdict is "patch", create a new proposal with agent_source='supervisor'
      if (review.verdict === 'patch' && review.patch_code) {
        const { error: insertError } = await supabase
          .from('cto_code_proposals')
          .insert({
            target_function: proposal.target_function,
            target_url: proposal.target_url,
            domain: proposal.domain,
            proposal_type: 'bugfix',
            title: `[Supervisor] Patch: ${proposal.title}`,
            description: `Correctif Supervisor sur proposition CTO #${proposal_id.substring(0, 8)}\n\n${review.patch_rationale || ''}`,
            diff_preview: review.patch_diff_summary || null,
            original_code: proposal.proposed_code,
            proposed_code: review.patch_code,
            confidence_score: review.supervisor_confidence || 85,
            source_diagnostic_id: proposal_id,
            status: 'pending',
            agent_source: 'supervisor',
          })

        if (insertError) {
          console.error('[SUPERVISOR] Insert patch error:', insertError)
        }
      }

      // 5. Log the review
      await supabase.from('supervisor_logs').insert({
        audit_id: `supervisor_review_${proposal_id}_${Date.now()}`,
        analysis_summary: `Review CTO proposal "${proposal.title}" — Verdict: ${review.verdict}, Score: ${review.quality_score}/100`,
        self_critique: `Issues: ${(review.issues_found || []).length}, Security: ${(review.security_concerns || []).length}`,
        confidence_score: review.supervisor_confidence || 0,
        decision: review.verdict === 'approve' ? 'approved' : 'needs_review',
        cto_score: review.quality_score || 0,
        correction_count: 1,
        functions_audited: [proposal.target_function],
        post_deploy_errors: 0,
        metadata: {
          type: 'cto_proposal_review',
          proposal_id,
          verdict: review.verdict,
          issues: review.issues_found,
          security: review.security_concerns,
        },
      })

      return jsonOk({
        success: true,
        review: {
          verdict: review.verdict,
          quality_score: review.quality_score,
          issues_found: review.issues_found,
          security_concerns: review.security_concerns,
          edge_cases_missed: review.edge_cases_missed,
          performance_notes: review.performance_notes,
          patch_created: review.verdict === 'patch',
          patch_rationale: review.patch_rationale,
          supervisor_confidence: review.supervisor_confidence,
        },
      })
    }

    // ─── Action: Get patch effectiveness report ───────────────
    if (action === 'patch_effectiveness') {
      const days = body.days || 30
      const patches = await fetchPatchEffectiveness(supabase, days)
      
      const effective = patches.filter((p: any) => p.is_effective)
      const ineffective = patches.filter((p: any) => !p.is_effective)
      const rate = patches.length > 0 ? Math.round((effective.length / patches.length) * 100) : null

      // Group by agent_source
      const byAgent: Record<string, { total: number, effective: number }> = {}
      for (const p of patches) {
        const src = p.agent_source || 'unknown'
        if (!byAgent[src]) byAgent[src] = { total: 0, effective: 0 }
        byAgent[src].total++
        if (p.is_effective) byAgent[src].effective++
      }

      // Group by target_function
      const byFunction: Record<string, { total: number, effective: number }> = {}
      for (const p of patches) {
        const fn = p.target_function || 'unknown'
        if (!byFunction[fn]) byFunction[fn] = { total: 0, effective: 0 }
        byFunction[fn].total++
        if (p.is_effective) byFunction[fn].effective++
      }

      return jsonOk({
        success: true,
        period_days: days,
        total_patches: patches.length,
        effective_count: effective.length,
        ineffective_count: ineffective.length,
        effectiveness_rate: rate,
        by_agent: byAgent,
        by_function: byFunction,
        recent_ineffective: ineffective.slice(0, 10).map((p: any) => ({
          target_function: p.target_function,
          agent_source: p.agent_source,
          errors_before: p.errors_before,
          errors_after: p.errors_after,
          error_reduction_pct: p.error_reduction_pct,
          deployment_date: p.deployment_date,
        })),
        recent_effective: effective.slice(0, 10).map((p: any) => ({
          target_function: p.target_function,
          agent_source: p.agent_source,
          errors_before: p.errors_before,
          errors_after: p.errors_after,
          error_reduction_pct: p.error_reduction_pct,
          deployment_date: p.deployment_date,
        })),
      })
    }

    return jsonError('Unknown action', 400)

  } catch (error) {
    console.error('[SUPERVISOR] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}));