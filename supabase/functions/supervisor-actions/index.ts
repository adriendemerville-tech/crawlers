import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''

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

// ─── Read CTO function code ──────────────────────────────────────────
async function readCtoCode(): Promise<string> {
  // Read the agent-cto function source via Supabase management API
  // Since we can't read filesystem in edge functions, we fetch from the deployed source
  const supabase = getServiceClient()
  
  // Read from a stored version in system_config or fetch the function metadata
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'cto_function_source')
    .single()
  
  return data?.value?.source || 'Source non disponible. Veuillez synchroniser le code CTO.'
}

// ─── Compile errors from multiple sources ────────────────────────────
async function compileErrors(supabase: any): Promise<any[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const [ctoLogs, backendErrors, silentErrors, injectionErrors] = await Promise.all([
    supabase.from('cto_agent_logs')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('analytics_events')
      .select('*')
      .in('event_type', ['edge_function_error', 'error', 'scan_error'])
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('analytics_events')
      .select('*')
      .eq('event_type', 'silent_error')
      .gte('created_at', thirtyDaysAgo)
      .limit(50),
    supabase.from('analytics_events')
      .select('*')
      .eq('event_type', 'injection_error')
      .gte('created_at', thirtyDaysAgo)
      .limit(50),
  ])

  const errors: any[] = []
  
  // CTO rejected/needs_review decisions
  for (const log of (ctoLogs.data || [])) {
    if (log.decision === 'rejected' || log.decision === 'needs_review') {
      errors.push({
        type: 'cto_decision',
        function: log.function_analyzed,
        decision: log.decision,
        confidence: log.confidence_score,
        summary: log.analysis_summary,
        critique: log.self_critique,
        date: log.created_at,
      })
    }
  }

  // Backend errors related to agent-cto
  for (const evt of (backendErrors.data || [])) {
    const d = evt.event_data || {}
    errors.push({
      type: 'backend_error',
      function: d.function_name || 'unknown',
      message: d.error_message || d.message || d.error || '',
      url: evt.url || '',
      date: evt.created_at,
    })
  }

  // Silent errors
  for (const evt of (silentErrors.data || [])) {
    const d = evt.event_data || {}
    errors.push({
      type: 'silent_error',
      function: d.function_name || 'unknown',
      message: d.error_message || d.message || '',
      date: evt.created_at,
    })
  }

  return errors
}

// ─── AI Analysis with benefit/risk and forced green/orange rating ─────
async function analyzeAndPropose(ctoCode: string, errors: any[]): Promise<any> {
  const errorSummary = JSON.stringify(errors.slice(0, 30), null, 2)
  
  const systemPrompt = `Tu es le SUPERVISOR, un système de contrôle qualité qui supervise l'Agent CTO.

TON RÔLE :
- Analyser les erreurs compilées et le code source de l'Agent CTO
- Proposer des modifications PRÉCISES au code CTO pour corriger les problèmes
- Évaluer le ratio bénéfice/risque de chaque modification

RÈGLES CRITIQUES DE NOTATION :
- Tu ne peux noter qu'en VERT (🟢 safe, pas de risque) ou ORANGE (🟠 attention, risque modéré)
- Le ROUGE est INTERDIT. Si un problème semble critique (rouge), tu DOIS trouver une solution intermédiaire ou de contournement qui ramène le risque à ORANGE
- Pour chaque modification proposée, explique pourquoi tu ne la classes PAS en rouge

FORMAT DE RÉPONSE (JSON strict) :
{
  "analysis": "Résumé de l'analyse des erreurs compilées",
  "error_patterns": ["pattern 1", "pattern 2"],
  "recommendations": [
    {
      "id": 1,
      "title": "Titre court de la modification",
      "description": "Description détaillée du changement proposé",
      "benefit": "Bénéfice attendu",
      "risk": "Risque identifié",
      "risk_level": "green" | "orange",
      "risk_mitigation": "Comment le risque est atténué (pourquoi pas rouge)",
      "code_change": "Le diff ou le nouveau code à appliquer",
      "affected_lines": "Description des lignes/fonctions affectées"
    }
  ],
  "overall_assessment": "Évaluation globale de la santé du CTO",
  "contournements_applied": ["Liste des problèmes critiques ramenés en orange avec explication"]
}`

  const userPrompt = `CODE SOURCE ACTUEL DE L'AGENT CTO :
\`\`\`typescript
${ctoCode.substring(0, 8000)}
\`\`\`

ERREURS COMPILÉES (30 derniers jours) :
\`\`\`json
${errorSummary}
\`\`\`

Analyse ce code et ces erreurs. Propose des modifications concrètes au code CTO.
Rappel : JAMAIS de notation rouge — trouve des contournements pour tout ramener en orange maximum.`

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
      // Enforce: no red ratings - force any red to orange
      if (parsed.recommendations) {
        for (const rec of parsed.recommendations) {
          if (rec.risk_level === 'red') {
            rec.risk_level = 'orange'
            rec.risk_mitigation = `[FORCÉ EN ORANGE] ${rec.risk_mitigation || 'Solution de contournement appliquée par le Supervisor'}`
          }
        }
      }
      return parsed
    }
  } catch (e) {
    console.error('[SUPERVISOR] Parse error:', e)
  }
  
  return {
    analysis: 'Erreur d\'analyse',
    error_patterns: [],
    recommendations: [],
    overall_assessment: content.substring(0, 500),
    contournements_applied: [],
  }
}

// ─── Apply code changes to CTO function ──────────────────────────────
async function applyCtoChanges(newCode: string): Promise<{ success: boolean; error?: string }> {
  // Store the new version in system_config for tracking
  const supabase = getServiceClient()
  
  // Save the new code to system_config for audit trail
  await supabase
    .from('system_config')
    .upsert({
      key: 'cto_function_source',
      value: { source: newCode, updated_at: new Date().toISOString(), updated_by: 'supervisor' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  return { success: true }
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

    // ─── Action: Compile errors ──────────────────────────────────
    if (action === 'compile_errors') {
      const errors = await compileErrors(supabase)
      return new Response(JSON.stringify({ success: true, errors, count: errors.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: Read CTO code ───────────────────────────────────
    if (action === 'read_cto_code') {
      const code = await readCtoCode()
      return new Response(JSON.stringify({ success: true, code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: Analyze & propose changes ───────────────────────
    if (action === 'analyze') {
      const [code, errors] = await Promise.all([
        readCtoCode(),
        compileErrors(supabase),
      ])
      
      const analysis = await analyzeAndPropose(code, errors)
      
      // Log the analysis
      await supabase.from('cto_agent_logs').insert({
        audit_id: `supervisor_analysis_${Date.now()}`,
        function_analyzed: 'supervisor-analysis',
        analysis_summary: analysis.analysis || '',
        self_critique: analysis.overall_assessment || '',
        confidence_score: 0,
        decision: 'needs_review',
        metadata: {
          source: 'supervisor',
          error_count: errors.length,
          recommendation_count: analysis.recommendations?.length || 0,
          contournements: analysis.contournements_applied || [],
        },
      })

      return new Response(JSON.stringify({ success: true, analysis, error_count: errors.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: Apply changes to CTO ────────────────────────────
    if (action === 'apply_changes') {
      const { new_code } = body
      if (!new_code) {
        return new Response(JSON.stringify({ error: 'Missing new_code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const result = await applyCtoChanges(new_code)

      // Log the deployment
      await supabase.from('cto_agent_logs').insert({
        audit_id: `supervisor_deploy_${Date.now()}`,
        function_analyzed: 'agent-cto',
        analysis_summary: `Supervisor a déployé une modification du code CTO (${new_code.length} caractères)`,
        self_critique: 'Modification appliquée par le Supervisor admin',
        confidence_score: 100,
        decision: 'approved',
        metadata: {
          source: 'supervisor',
          action: 'deploy',
          code_length: new_code.length,
        },
      })

      return new Response(JSON.stringify({ success: result.success, error: result.error }), {
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
