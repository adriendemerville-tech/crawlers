import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Agent CTO v2 — Data-Driven Prompt Optimization
 * 
 * Replaces subjective LLM self-evaluation with a correlation engine
 * based on real-world metrics (GSC, DataForSEO, PageSpeed).
 * 
 * Decision flow:
 * 1. Gather historical reliability data from audit_impact_snapshots
 * 2. Compute per-function reliability scores
 * 3. Use real evidence to justify prompt changes
 * 4. Only modify prompts when statistical evidence supports it
 */

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// ─── Types ────────────────────────────────────────────────────────────
interface ReliabilityProfile {
  function_name: string
  total_snapshots: number
  snapshots_with_gsc: number
  avg_impact_score: number
  grade_distribution: Record<string, number>
  avg_action_plan_progress: number
  code_deployment_rate: number
  widget_connection_rate: number  // % of tracked sites with active GTM/widget ping
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data'
}

interface AgentDecision {
  analysis_summary: string
  self_critique: string
  confidence_score: number
  proposed_change: string | null
  change_diff_pct: number
  decision: 'approved' | 'rejected' | 'needs_review'
  evidence_basis: 'real_data' | 'heuristic' | 'insufficient_data'
}

// ─── Reliability engine ───────────────────────────────────────────────
async function getReliabilityProfile(supabase: any, functionName: string): Promise<ReliabilityProfile> {
  // Fetch snapshots + widget connection stats in parallel
  const [{ data: snapshots }, { data: trackedSites }] = await Promise.all([
    supabase
      .from('audit_impact_snapshots')
      .select('impact_score, reliability_grade, action_plan_progress, corrective_code_deployed, gsc_baseline, measurement_phase, created_at')
      .eq('audit_type', mapFunctionToAuditType(functionName))
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('tracked_sites')
      .select('last_widget_ping')
      .not('last_widget_ping', 'is', null),
  ])

  const all = snapshots || []
  const withGsc = all.filter((s: any) => s.gsc_baseline != null)
  const completed = all.filter((s: any) => s.measurement_phase === 'complete' && s.impact_score != null)

  // Grade distribution
  const grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0, 'N/A': 0 }
  completed.forEach((s: any) => {
    const g = s.reliability_grade || 'N/A'
    grades[g] = (grades[g] || 0) + 1
  })

  // Widget connection rate: % of tracked sites with a recent ping (<7 days)
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const allTracked = trackedSites || []
  const activeWidgets = allTracked.filter((s: any) => {
    if (!s.last_widget_ping) return false
    return (Date.now() - new Date(s.last_widget_ping).getTime()) < SEVEN_DAYS
  })
  const widgetConnectionRate = allTracked.length > 0
    ? Math.round(activeWidgets.length / allTracked.length * 100)
    : 0

  // Trend: compare last 10 vs previous 10
  let trend: ReliabilityProfile['trend'] = 'insufficient_data'
  if (completed.length >= 10) {
    const recent = completed.slice(0, 5)
    const older = completed.slice(5, 10)
    const recentAvg = recent.reduce((s: number, r: any) => s + r.impact_score, 0) / recent.length
    const olderAvg = older.reduce((s: number, r: any) => s + r.impact_score, 0) / older.length
    const diff = recentAvg - olderAvg
    if (diff > 5) trend = 'improving'
    else if (diff < -5) trend = 'declining'
    else trend = 'stable'
  }

  return {
    function_name: functionName,
    total_snapshots: all.length,
    snapshots_with_gsc: withGsc.length,
    avg_impact_score: completed.length > 0
      ? Math.round(completed.reduce((s: number, r: any) => s + r.impact_score, 0) / completed.length * 10) / 10
      : 0,
    grade_distribution: grades,
    avg_action_plan_progress: all.length > 0
      ? Math.round(all.reduce((s: number, r: any) => s + (r.action_plan_progress || 0), 0) / all.length)
      : 0,
    code_deployment_rate: all.length > 0
      ? Math.round(all.filter((r: any) => r.corrective_code_deployed).length / all.length * 100)
      : 0,
    widget_connection_rate: widgetConnectionRate,
    trend,
  }
}

function mapFunctionToAuditType(functionName: string): string {
  const map: Record<string, string> = {
    'audit-expert-seo': 'expert',
    'audit-strategique-ia': 'strategic',
    'audit-compare': 'compare',
    'crawl-site': 'crawl',
  }
  return map[functionName] || functionName
}

// ─── Agent config check ──────────────────────────────────────────────
async function isAgentEnabled(): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'cto_agent_enabled')
    .single()
  return data?.value?.enabled === true
}

// ─── Champion prompt ─────────────────────────────────────────────────
async function getChampionPrompt(supabase: any, functionName: string, promptKey = 'system'): Promise<{ version: number; prompt_text: string } | null> {
  const { data } = await supabase
    .from('prompt_registry')
    .select('version, prompt_text')
    .eq('function_name', functionName)
    .eq('prompt_key', promptKey)
    .eq('is_champion', true)
    .single()
  return data
}

// ─── LLM call ────────────────────────────────────────────────────────
async function callLLM(systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crawlers.fr',
      'X-Title': 'Crawlers CTO Agent v2',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const tokens = {
    input: data.usage?.prompt_tokens || 0,
    output: data.usage?.completion_tokens || 0,
  }
  trackPaidApiCall('agent-cto', 'openrouter', 'anthropic/claude-3.5-sonnet')
  return { content, tokens }
}

// ─── Response parser ─────────────────────────────────────────────────
function parseAgentResponse(raw: string, evidenceBasis: AgentDecision['evidence_basis']): AgentDecision {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const confidence = Math.min(100, Math.max(0, Number(parsed.confidence_score) || 0))
      const diffPct = Math.min(100, Math.max(0, Number(parsed.change_diff_pct) || 0))

      // Stricter approval with real data: 95% confidence + ≤10% change + evidence
      const canApprove = confidence >= 95 && diffPct <= 10 && evidenceBasis === 'real_data'

      return {
        analysis_summary: parsed.analysis_summary || 'No summary',
        self_critique: parsed.self_critique || 'No critique',
        confidence_score: confidence,
        proposed_change: parsed.proposed_change || null,
        change_diff_pct: diffPct,
        decision: canApprove ? 'approved' : (confidence >= 80 ? 'needs_review' : 'rejected'),
        evidence_basis: evidenceBasis,
      }
    }
  } catch (e) {
    console.error('[AGENT-CTO] Parse error:', e)
  }
  return {
    analysis_summary: 'Failed to parse response',
    self_critique: raw.substring(0, 500),
    confidence_score: 0,
    proposed_change: null,
    change_diff_pct: 0,
    decision: 'rejected',
    evidence_basis: 'insufficient_data',
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const enabled = await isAgentEnabled()
    if (!enabled) {
      return new Response(JSON.stringify({ success: false, reason: 'Agent CTO désactivé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { auditResult, auditType, url, domain } = await req.json()

    if (!auditResult || !auditType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing auditResult or auditType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const AUDIT_TYPE_TO_FUNCTION: Record<string, string> = {
      'technical': 'audit-expert-seo',
      'strategic': 'audit-strategique-ia',
      'compare': 'audit-compare',
      'crawl': 'crawl-site',
      'llm-visibility': 'check-llm',
      'llm-depth': 'check-llm-depth',
      'geo': 'check-geo',
      'pagespeed': 'check-pagespeed',
      'crawlers': 'check-crawlers',
      'hallucination': 'diagnose-hallucination',
      'local-seo': 'audit-local-seo',
      'corrective-code': 'generate-corrective-code',
      'llm-volumes': 'calculate-llm-volumes',
    }
    const functionName = AUDIT_TYPE_TO_FUNCTION[auditType] || auditType

    // ─── Phase 1: Gather real evidence ──────────────────────────────
    const [champion, reliability] = await Promise.all([
      getChampionPrompt(supabase, functionName),
      getReliabilityProfile(supabase, functionName),
    ])

    const currentVersion = champion?.version || 0
    const currentPrompt = champion?.prompt_text || 'Aucun prompt enregistré — première analyse.'

    // Determine evidence basis
    let evidenceBasis: AgentDecision['evidence_basis'] = 'insufficient_data'
    if (reliability.snapshots_with_gsc >= 5 && reliability.total_snapshots >= 10) {
      evidenceBasis = 'real_data'
    } else if (reliability.total_snapshots >= 3) {
      evidenceBasis = 'heuristic'
    }

    const auditSummary = JSON.stringify(auditResult).substring(0, 6000)

    // ─── Phase 2: Build evidence-aware prompt ───────────────────────
    const systemPrompt = `Tu es un Agent CTO v2 spécialisé en SEO/GEO. Tu disposes désormais de DONNÉES RÉELLES provenant de Google Search Console, DataForSEO et PageSpeed pour évaluer la pertinence des audits.

DONNÉES DE FIABILITÉ (statistiques mesurées sur de vrais utilisateurs) :
- Fonction analysée : ${functionName}
- Snapshots totaux : ${reliability.total_snapshots}
- Snapshots avec données GSC : ${reliability.snapshots_with_gsc}
- Score d'impact moyen : ${reliability.avg_impact_score}/100
- Distribution des grades : ${JSON.stringify(reliability.grade_distribution)}
- Progression moyenne des plans d'action : ${reliability.avg_action_plan_progress}%
- Taux de déploiement de code correctif : ${reliability.code_deployment_rate}%
- Taux de connexion widget (GTM/script) : ${reliability.widget_connection_rate}% des sites suivis ont un widget actif (<7j)
- Tendance : ${reliability.trend}
- Base d'évidence : ${evidenceBasis}

RÈGLES STRICTES :
1. RÈGLE DES 10% : Max 10% de modification du prompt existant.
2. SEUIL DE CONFIANCE : 95% minimum. Sans données GSC suffisantes (${reliability.snapshots_with_gsc} snapshots), tu ne peux PAS approuver de changement.
3. CORRÉLATION OBLIGATOIRE : Toute suggestion doit être justifiée par les métriques réelles ci-dessus, pas par ton intuition.
4. Si le score d'impact moyen est < 0 (grade D/F dominant), concentre-toi sur les corrections majeures.
5. Si la tendance est "declining", identifie pourquoi et propose un correctif ciblé.
6. Si "insufficient_data", propose uniquement des observations, AUCUN changement.

Réponds UNIQUEMENT en JSON :
{
  "analysis_summary": "Analyse basée sur les données réelles",
  "self_critique": "Risques identifiés + biais potentiels",
  "confidence_score": 0-100,
  "proposed_change": "Nouveau prompt (null si aucun)",
  "change_diff_pct": 0-100,
  "data_driven_insights": "Ce que les métriques réelles révèlent"
}`

    const userPrompt = `FONCTION : ${functionName}
DOMAINE : ${domain || 'N/A'}
URL : ${url || 'N/A'}

PROMPT ACTUEL (v${currentVersion}) :
---
${currentPrompt}
---

RÉSULTAT DE L'AUDIT (tronqué) :
---
${auditSummary}
---

Analyse cet audit en te basant UNIQUEMENT sur les données de fiabilité fournies dans ton contexte. Les métriques GSC sont la seule vérité terrain — si tu n'en as pas assez, dis-le clairement.`

    console.log(`[AGENT-CTO v2] Analyse ${functionName} pour ${domain} — evidence: ${evidenceBasis}, impact_avg: ${reliability.avg_impact_score}, trend: ${reliability.trend}`)

    const { content, tokens } = await callLLM(systemPrompt, userPrompt)

    trackTokenUsage('agent-cto', 'anthropic/claude-3.5-sonnet', tokens.input, tokens.output).catch(() => {})

    const analysis = parseAgentResponse(content, evidenceBasis)

    console.log(`[AGENT-CTO v2] Décision: ${analysis.decision} (confiance: ${analysis.confidence_score}%, evidence: ${analysis.evidence_basis})`)

    // ─── Phase 3: Log & optionally update prompt ────────────────────
    const logEntry: any = {
      audit_id: `${domain}_${Date.now()}`,
      function_analyzed: functionName,
      analysis_summary: analysis.analysis_summary,
      self_critique: analysis.self_critique,
      confidence_score: analysis.confidence_score,
      proposed_change: analysis.proposed_change,
      change_diff_pct: analysis.change_diff_pct,
      decision: analysis.decision,
      prompt_version_before: currentVersion,
      metadata: {
        url,
        domain,
        auditType,
        tokens,
        evidence_basis: analysis.evidence_basis,
        reliability_profile: {
          total_snapshots: reliability.total_snapshots,
          snapshots_with_gsc: reliability.snapshots_with_gsc,
          avg_impact_score: reliability.avg_impact_score,
          trend: reliability.trend,
          grade_distribution: reliability.grade_distribution,
          widget_connection_rate: reliability.widget_connection_rate,
        },
      },
    }

    // Only approve changes backed by real data
    if (analysis.decision === 'approved' && analysis.proposed_change && analysis.evidence_basis === 'real_data') {
      const newVersion = currentVersion + 1

      if (champion) {
        await supabase
          .from('prompt_registry')
          .update({ is_champion: false })
          .eq('function_name', functionName)
          .eq('prompt_key', 'system')
          .eq('is_champion', true)
      }

      const { error: insertError } = await supabase
        .from('prompt_registry')
        .insert({
          function_name: functionName,
          prompt_key: 'system',
          version: newVersion,
          prompt_text: analysis.proposed_change,
          is_champion: true,
          created_by: 'agent-cto-v2',
          metadata: {
            confidence_score: analysis.confidence_score,
            change_diff_pct: analysis.change_diff_pct,
            evidence_basis: analysis.evidence_basis,
            reliability_snapshot: {
              avg_impact: reliability.avg_impact_score,
              gsc_samples: reliability.snapshots_with_gsc,
              trend: reliability.trend,
            },
          },
        })

      if (insertError) {
        console.error('[AGENT-CTO v2] Erreur insertion prompt:', insertError)
        logEntry.decision = 'rejected'
        logEntry.metadata.insert_error = insertError.message
      } else {
        logEntry.prompt_version_after = newVersion
        console.log(`[AGENT-CTO v2] ✅ Nouveau prompt champion v${newVersion} pour ${functionName} (evidence: real_data)`)
      }
    }

    const { error: logError } = await supabase.from('cto_agent_logs').insert(logEntry)
    if (logError) console.error('[AGENT-CTO v2] Erreur log:', logError)

    return new Response(JSON.stringify({
      success: true,
      decision: analysis.decision,
      confidence: analysis.confidence_score,
      evidence_basis: analysis.evidence_basis,
      reliability: {
        avg_impact: reliability.avg_impact_score,
        trend: reliability.trend,
        gsc_samples: reliability.snapshots_with_gsc,
      },
      version: logEntry.prompt_version_after || currentVersion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[AGENT-CTO v2] Erreur:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
