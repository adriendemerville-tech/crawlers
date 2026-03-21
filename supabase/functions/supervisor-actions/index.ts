import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

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
async function auditCorrections(corrections: any[], functionSources: Record<string, string>, postErrors: any[]): Promise<any> {
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
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check kill switch
    const enabled = await isSupervisorEnabled()
    if (!enabled) {
      return new Response(JSON.stringify({ success: false, reason: 'Supervisor désactivé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Auth check - admin only
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getServiceClient()
    
    // Verify admin role
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .single()
    
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    // ─── Action: List CTO corrections ────────────────────────────
    if (action === 'list_corrections') {
      const corrections = await collectCtoCorrections(supabase)
      return new Response(JSON.stringify({ success: true, corrections, count: corrections.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

      // Read source code for each modified function + check post-deploy errors
      const [functionSources, postErrors] = await Promise.all([
        Promise.all(functionNames.map(async (name: string) => {
          const src = await readFunctionSource(supabase, name)
          return [name, src] as [string, string]
        })).then(entries => Object.fromEntries(entries)),
        getPostDeployErrors(supabase, functionNames as string[]),
      ])

      const analysis = await auditCorrections(corrections, functionSources, postErrors)

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

      return new Response(JSON.stringify({
        success: true,
        analysis,
        correction_count: corrections.length,
        functions_audited: functionNames,
        post_deploy_errors: postErrors.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: Toggle kill switches ────────────────────────────
    if (action === 'toggle_killswitch') {
      const { target, enabled: newState } = body
      if (!['supervisor_enabled', 'cto_agent_enabled'].includes(target)) {
        return new Response(JSON.stringify({ error: 'Invalid target' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase
        .from('system_config')
        .upsert({
          key: target,
          value: { enabled: newState },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      return new Response(JSON.stringify({ success: true, target, enabled: newState }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

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
})
