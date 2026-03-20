import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

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
// Supabase client via _shared/supabaseClient.ts (singleton)

// ─── Types ────────────────────────────────────────────────────────────
interface ReliabilityProfile {
  function_name: string
  total_snapshots: number
  snapshots_with_gsc: number
  snapshots_with_ga4: number
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
      .select('impact_score, reliability_grade, action_plan_progress, corrective_code_deployed, gsc_baseline, ga4_baseline, ga4_t90, measurement_phase, created_at')
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
  const withGa4 = all.filter((s: any) => s.ga4_baseline != null)
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
    snapshots_with_ga4: withGa4.length,
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
  const supabase = getServiceClient()
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

// ─── Cache Health Check ───────────────────────────────────────────────
interface CacheHealthReport {
  total_entries: number
  expired_entries: number
  entries_by_type: Record<string, number>
  anomalies: string[]
  score_stats: { avg: number; min: number; max: number; stddev: number } | null
  empty_results_count: number
  oldest_entry_age_hours: number
  status: 'healthy' | 'warning' | 'critical'
}

async function checkCacheHealth(supabase: any): Promise<CacheHealthReport> {
  const now = new Date().toISOString()

  // Fetch all cache entries (recent 2 weeks)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: entries, error } = await supabase
    .from('domain_data_cache')
    .select('domain, data_type, week_start_date, result_data, created_at, expires_at')
    .gt('created_at', twoWeeksAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !entries) {
    return {
      total_entries: 0, expired_entries: 0, entries_by_type: {},
      anomalies: [`Erreur lecture cache: ${error?.message || 'no data'}`],
      score_stats: null, empty_results_count: 0, oldest_entry_age_hours: 0,
      status: 'critical',
    }
  }

  const anomalies: string[] = []
  const entriesByType: Record<string, number> = {}
  let expiredCount = 0
  let emptyCount = 0
  const allScores: number[] = []

  for (const e of entries) {
    // Count by type
    entriesByType[e.data_type] = (entriesByType[e.data_type] || 0) + 1

    // Expired?
    if (new Date(e.expires_at) < new Date(now)) expiredCount++

    // Empty result_data?
    const rd = e.result_data
    if (!rd || (typeof rd === 'object' && Object.keys(rd).length === 0)) {
      emptyCount++
      anomalies.push(`⚠️ Résultat vide pour ${e.domain} (${e.data_type}, ${e.week_start_date || 'n/a'})`)
    }

    // Extract visibility scores for statistical analysis
    if (e.data_type === 'llm_visibility' && rd?.scores && Array.isArray(rd.scores)) {
      for (const s of rd.scores) {
        if (typeof s.score_percentage === 'number') {
          allScores.push(s.score_percentage)
        }
      }
      // Check for all-zero scores (anomaly: brand never found)
      const allZero = rd.scores.every((s: any) => s.score_percentage === 0)
      if (allZero && rd.scores.length > 0) {
        anomalies.push(`🔴 Tous les scores LLM à 0% pour ${e.domain} — possible erreur de détection de marque`)
      }
    }

    // Check for llm_depth with degraded data
    if (e.data_type === 'llm_depth' && rd) {
      const depth = rd as any
      if (depth.error || depth.status === 'error') {
        anomalies.push(`🔴 Audit profondeur en erreur pour ${e.domain}`)
      }
    }
  }

  // Statistical analysis on visibility scores
  let scoreStats: CacheHealthReport['score_stats'] = null
  if (allScores.length >= 5) {
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length
    const min = Math.min(...allScores)
    const max = Math.max(...allScores)
    const variance = allScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / allScores.length
    const stddev = Math.sqrt(variance)
    scoreStats = { avg: Math.round(avg * 10) / 10, min, max, stddev: Math.round(stddev * 10) / 10 }

    // Anomaly: sudden score collapse (all recent scores way below average)
    const recentScores = allScores.slice(0, Math.min(10, allScores.length))
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    if (recentAvg < avg * 0.5 && avg > 10) {
      anomalies.push(`📉 Chute brutale des scores récents: moyenne récente ${Math.round(recentAvg)}% vs globale ${Math.round(avg)}%`)
    }

    // Anomaly: abnormal standard deviation
    if (stddev > 35 && allScores.length > 10) {
      anomalies.push(`📊 Écart-type anormalement élevé (${scoreStats.stddev}) — possible instabilité des résultats LLM`)
    }
  }

  // Oldest entry age
  const oldestCreated = entries.length > 0 ? entries[entries.length - 1].created_at : now
  const oldestAgeHours = Math.round((Date.now() - new Date(oldestCreated).getTime()) / (1000 * 60 * 60))

  // Empty results threshold
  if (emptyCount > entries.length * 0.1 && emptyCount > 2) {
    anomalies.push(`⚠️ ${emptyCount}/${entries.length} entrées vides (>${Math.round(emptyCount / entries.length * 100)}%)`)
  }

  // Determine status
  let status: CacheHealthReport['status'] = 'healthy'
  if (anomalies.some(a => a.startsWith('🔴'))) status = 'critical'
  else if (anomalies.length > 3) status = 'warning'
  else if (emptyCount > 5) status = 'warning'

  return {
    total_entries: entries.length,
    expired_entries: expiredCount,
    entries_by_type: entriesByType,
    anomalies,
    score_stats: scoreStats,
    empty_results_count: emptyCount,
    oldest_entry_age_hours: oldestAgeHours,
    status,
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

    const body = await req.json()

    // ─── Mode: Cache Health Check ─────────────────────────────────
    if (body.action === 'cache_health_check') {
      const supabase = getServiceClient()
      const report = await checkCacheHealth(supabase)

      console.log(`[AGENT-CTO] 🏥 Cache health: ${report.status} — ${report.total_entries} entries, ${report.anomalies.length} anomalies`)

      // Log the health check
      await supabase.from('cto_agent_logs').insert({
        audit_id: `cache_health_${Date.now()}`,
        function_analyzed: 'domain_data_cache',
        analysis_summary: `Cache santé: ${report.status}. ${report.total_entries} entrées, ${report.anomalies.length} anomalies détectées.`,
        self_critique: report.anomalies.length > 0
          ? `Anomalies: ${report.anomalies.join(' | ')}`
          : 'Aucune anomalie détectée.',
        confidence_score: report.status === 'healthy' ? 100 : report.status === 'warning' ? 60 : 20,
        decision: report.status === 'critical' ? 'needs_review' : 'approved',
        metadata: {
          cache_health: report,
          check_type: 'daily_automated',
        },
      })

      return new Response(JSON.stringify({ success: true, report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Mode: Standard audit analysis ────────────────────────────
    const { auditResult, auditType, url, domain } = body

    if (!auditResult || !auditType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing auditResult or auditType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getServiceClient()

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
      'cocoon': 'calculate-cocoon-logic',
      'cocoon-chat': 'cocoon-chat',
      'cocoon-pagerank': 'calculate-internal-pagerank',
      'cocoon-session': 'persist-cocoon-session',
      'matrice': 'audit-matrice',
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
    // Evidence basis: now factors in GA4 coverage
    let evidenceBasis: AgentDecision['evidence_basis'] = 'insufficient_data'
    if (reliability.snapshots_with_gsc >= 5 && reliability.total_snapshots >= 10) {
      evidenceBasis = 'real_data'
    } else if (reliability.snapshots_with_gsc >= 3 && reliability.snapshots_with_ga4 >= 2) {
      // GA4 can supplement insufficient GSC to reach 'real_data' threshold
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
- Snapshots avec données GA4 : ${reliability.snapshots_with_ga4}
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

    trackTokenUsage('agent-cto', 'anthropic/claude-3.5-sonnet', { prompt_tokens: tokens.input, completion_tokens: tokens.output, total_tokens: tokens.input + tokens.output }).catch(() => {})

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
          snapshots_with_ga4: reliability.snapshots_with_ga4,
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
