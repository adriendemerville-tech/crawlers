import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'
import { callOpenRouter } from '../_shared/openRouterAI.ts'

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
  const resp = await callOpenRouter({
    model: 'anthropic/claude-3.5-sonnet',
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.2,
    maxTokens: 4000,
    title: 'Crawlers CTO Agent v2',
  });

  trackPaidApiCall('agent-cto', 'openrouter', 'anthropic/claude-3.5-sonnet')
  return {
    content: resp.content,
    tokens: {
      input: resp.usage?.prompt_tokens || 0,
      output: resp.usage?.completion_tokens || 0,
    },
  }
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

    // ─── Mode: Manual re-analyze (admin "Mettre à jour" button) ───
    if (body.action === 'analyze') {
      const supabase = getServiceClient()

      const { data: latestRaw, error: rawError } = await supabase
        .from('audit_raw_data')
        .select('audit_type, url, domain, raw_payload')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (rawError || !latestRaw) {
        return new Response(JSON.stringify({
          success: false,
          analysis_summary: 'Aucune donnée d\'audit récente à analyser — lancez un audit depuis la console.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-cto`
      const selfResponse = await fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          auditResult: latestRaw.raw_payload,
          auditType: latestRaw.audit_type,
          url: latestRaw.url,
          domain: latestRaw.domain,
        }),
      })

      const selfResult = await selfResponse.json()
      return new Response(JSON.stringify(selfResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Mode: Diagnose Marina errors ───────────────────────────
    if (body.action === 'diagnose_marina_errors') {
      const supabase = getServiceClient()
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: failedJobs } = await supabase
        .from('async_jobs')
        .select('*')
        .eq('function_name', 'marina')
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20)

      // Also check marina-related silent errors
      const { data: silentErrors } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('event_type', 'silent_error')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100)

      const marinaErrors = (silentErrors || []).filter((e: any) => {
        const fn = e.event_data?.function_name || ''
        return ['marina', 'fetch-external-site', 'crawl-site', 'audit-expert-seo', 'audit-strategique-ia', 'calculate-cocoon-logic', 'calculate-llm-visibility'].includes(fn)
      })

      if ((!failedJobs || failedJobs.length === 0) && marinaErrors.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'Aucune erreur Marina à diagnostiquer.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Summarize for LLM
      const jobsSummary = (failedJobs || []).map((j: any) => ({
        id: j.id,
        url: j.input_payload?.url,
        error: j.error_message,
        created_at: j.created_at,
        progress: j.progress,
      }))

      const errorsSummary = marinaErrors.slice(0, 20).map((e: any) => ({
        function: e.event_data?.function_name,
        error: e.event_data?.error_message,
        operation: e.event_data?.operation,
        created_at: e.created_at,
      }))

      const { content, tokens } = await callLLM(
        'Tu es un agent CTO spécialisé dans le diagnostic de pipelines. Sois précis et factuel.',
        `Diagnostique les erreurs du pipeline Marina (prospection automatisée : Crawl → Audit SEO → Audit GEO → Cocon → Rapport HTML).

JOBS EN ÉCHEC (7 derniers jours) :
${JSON.stringify(jobsSummary, null, 2)}

ERREURS SILENCIEUSES liées à Marina :
${JSON.stringify(errorsSummary, null, 2)}

Réponds en JSON :
{
  "root_causes": ["Cause principale 1", ...],
  "pattern": "Pattern récurrent identifié ou null",
  "severity": "low|medium|high|critical",
  "recommendations": ["Recommandation 1", ...],
  "auto_fixable": false,
  "summary": "Résumé en une phrase"
}`,
      )

      trackTokenUsage('agent-cto', 'anthropic/claude-3.5-sonnet', {
        prompt_tokens: tokens.input,
        completion_tokens: tokens.output,
        total_tokens: tokens.input + tokens.output,
      }).catch(() => {})

      let diagnosis: any = null
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) diagnosis = JSON.parse(jsonMatch[0])
      } catch { /* ignore */ }

      // Log in CTO agent logs
      await supabase.from('cto_agent_logs').insert({
        audit_id: `marina_diag_${Date.now()}`,
        function_analyzed: 'marina',
        analysis_summary: diagnosis?.summary || 'Diagnostic Marina effectué',
        self_critique: `${(failedJobs || []).length} jobs échoués, ${marinaErrors.length} erreurs silencieuses`,
        confidence_score: 75,
        decision: 'needs_review',
        metadata: { diagnosis, failed_jobs_count: (failedJobs || []).length, silent_errors_count: marinaErrors.length, tokens },
      })

      return new Response(JSON.stringify({
        success: true,
        failed_jobs: (failedJobs || []).length,
        silent_errors: marinaErrors.length,
        diagnosis,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Mode: Diagnose frontend crashes ──────────────────────────
    if (body.action === 'diagnose_frontend_crashes') {
      const supabase = getServiceClient()
      const CONFIDENCE_THRESHOLD = 85

      // Fetch unprocessed frontend crashes (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: crashes } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('event_type', 'frontend_crash')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!crashes || crashes.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'Aucun crash frontend à diagnostiquer.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Deduplicate by error_message to avoid analyzing the same crash multiple times
      const uniqueCrashes = new Map<string, any>()
      for (const crash of crashes) {
        const key = crash.event_data?.error_message || crash.id
        if (!uniqueCrashes.has(key)) {
          uniqueCrashes.set(key, { ...crash, occurrence_count: 1 })
        } else {
          uniqueCrashes.get(key)!.occurrence_count++
        }
      }

      const results: any[] = []

      for (const [errorKey, crash] of uniqueCrashes) {
        const eventData = crash.event_data || {}

        // Check if already diagnosed (avoid re-processing)
        const { data: existing } = await supabase
          .from('user_bug_reports')
          .select('id')
          .eq('category', 'bug_ui')
          .eq('source_assistant', 'cto-auto')
          .ilike('raw_message', `%${(eventData.error_message || '').substring(0, 50)}%`)
          .limit(1)

        if (existing && existing.length > 0) {
          results.push({ error: errorKey, status: 'already_diagnosed' })
          continue
        }

        // Ask LLM to diagnose the crash
        const diagnosisPrompt = `Tu es un CTO expert React/TypeScript. Analyse ce crash frontend et détermine :
1. La CAUSE RACINE probable
2. Si c'est un problème DATA-SIDE (données null/undefined en base, config manquante, format API inattendu) ou CODE-SIDE (bug dans le JSX/TypeScript, import manquant, logique conditionnelle)
3. Si DATA-SIDE : quelle table/colonne/valeur corriger
4. Un score de CONFIANCE (0-100) sur ton diagnostic

CRASH FRONTEND :
- Erreur : ${eventData.error_message || 'Unknown'}
- Route : ${eventData.route || 'Unknown'}
- Stack : ${(eventData.stack || eventData.component_stack || '').substring(0, 1500)}
- Occurrences : ${crash.occurrence_count}
- User Agent : ${(eventData.user_agent || '').substring(0, 100)}

Réponds UNIQUEMENT en JSON :
{
  "cause_type": "data_side" | "code_side",
  "root_cause": "Explication concise de la cause racine",
  "confidence": 0-100,
  "fix_description": "Description du fix proposé",
  "data_fix": {
    "table": "nom_table ou null",
    "action": "Description SQL ou null",
    "safe_to_auto_fix": true/false
  },
  "code_fix_recommendation": "Recommandation pour fix code-side ou null",
  "severity": "low" | "medium" | "high" | "critical"
}`

        const { content, tokens } = await callLLM(
          'Tu es un agent CTO spécialisé en diagnostic de crashs frontend React. Sois précis et factuel.',
          diagnosisPrompt,
        )

        trackTokenUsage('agent-cto', 'anthropic/claude-3.5-sonnet', {
          prompt_tokens: tokens.input,
          completion_tokens: tokens.output,
          total_tokens: tokens.input + tokens.output,
        }).catch(() => {})

        // Parse LLM response
        let diagnosis: any = null
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          if (jsonMatch) diagnosis = JSON.parse(jsonMatch[0])
        } catch { /* ignore parse errors */ }

        if (!diagnosis) {
          results.push({ error: errorKey, status: 'parse_failed' })
          continue
        }

        const confidence = Math.min(100, Math.max(0, Number(diagnosis.confidence) || 0))

        // ─── DATA-SIDE FIX (auto if confidence ≥ 85%) ─────────────
        if (diagnosis.cause_type === 'data_side' && confidence >= CONFIDENCE_THRESHOLD && diagnosis.data_fix?.safe_to_auto_fix) {
          // Execute the data fix via targeted safe operations
          let fixApplied = false
          let fixError = ''

          try {
            // Only allow safe operations: inserting default configs, updating null values
            // The LLM provides the fix description but we only execute pre-approved patterns
            const fix = diagnosis.data_fix
            if (fix.table && fix.action) {
              // Log the auto-fix attempt
              console.log(`[AGENT-CTO] 🔧 Auto-fix data-side: ${fix.table} — ${fix.action}`)
              
              // For safety: we don't execute raw SQL. Instead we create a detailed recettage entry
              // marked as "auto-fixable" for admin one-click approval
              fixApplied = true
            }
          } catch (e) {
            fixError = e instanceof Error ? e.message : String(e)
          }

          // Create recettage entry with auto-fix details
          await supabase.from('user_bug_reports').insert({
            user_id: crash.user_id || '00000000-0000-0000-0000-000000000000',
            raw_message: `[CTO AUTO-DIAG] ${eventData.error_message || 'Frontend crash'}`,
            translated_message: `🔧 Cause data-side détectée (confiance ${confidence}%) : ${diagnosis.root_cause}\n\nFix proposé : ${diagnosis.fix_description}\n\nTable : ${diagnosis.data_fix?.table || 'N/A'}\nAction : ${diagnosis.data_fix?.action || 'N/A'}`,
            category: 'bug_data',
            route: eventData.route || null,
            source_assistant: 'cto-auto',
            status: fixApplied ? 'investigating' : 'open',
            context_data: {
              crash_event_id: crash.id,
              diagnosis,
              confidence,
              occurrences: crash.occurrence_count,
              stack_preview: (eventData.stack || '').substring(0, 500),
              auto_fix_applied: fixApplied,
              auto_fix_error: fixError || null,
            },
            cto_response: fixApplied
              ? `✅ Fix data-side identifié et prêt pour validation admin.\nConfiance: ${confidence}%\nAction: ${diagnosis.data_fix?.action}`
              : `⚠️ Fix identifié mais confiance insuffisante ou fix non-sécurisé.\nConfiance: ${confidence}%`,
          })

          results.push({ error: errorKey, status: 'data_fix_proposed', confidence, fix: diagnosis.data_fix })

        // ─── CODE-SIDE (recommendation only) ──────────────────────
        } else {
          // Create recettage entry with code-side recommendation
          await supabase.from('user_bug_reports').insert({
            user_id: crash.user_id || '00000000-0000-0000-0000-000000000000',
            raw_message: `[CTO AUTO-DIAG] ${eventData.error_message || 'Frontend crash'}`,
            translated_message: `🔍 Cause ${diagnosis.cause_type === 'code_side' ? 'code-side' : 'indéterminée'} (confiance ${confidence}%) : ${diagnosis.root_cause}\n\n${diagnosis.code_fix_recommendation || diagnosis.fix_description || 'Aucune recommandation spécifique.'}`,
            category: diagnosis.cause_type === 'code_side' ? 'bug_ui' : 'bug_function',
            route: eventData.route || null,
            source_assistant: 'cto-auto',
            status: 'open',
            context_data: {
              crash_event_id: crash.id,
              diagnosis,
              confidence,
              occurrences: crash.occurrence_count,
              stack_preview: (eventData.stack || '').substring(0, 500),
              requires_code_fix: true,
            },
            cto_response: confidence >= CONFIDENCE_THRESHOLD
              ? `📋 Recommandation code-side (confiance ${confidence}%) :\n${diagnosis.code_fix_recommendation || diagnosis.fix_description}`
              : `⚠️ Diagnostic incertain (confiance ${confidence}%). Analyse manuelle recommandée.`,
          })

          results.push({ error: errorKey, status: 'code_recommendation', confidence, cause: diagnosis.cause_type })
        }

        // Log in CTO agent logs
        await supabase.from('cto_agent_logs').insert({
          audit_id: `frontend_crash_${crash.id}`,
          function_analyzed: 'frontend_crash',
          analysis_summary: `Crash frontend sur ${eventData.route || '/'}: ${diagnosis.root_cause}`,
          self_critique: `Cause: ${diagnosis.cause_type}, Sévérité: ${diagnosis.severity}, Occurrences: ${crash.occurrence_count}`,
          confidence_score: confidence,
          decision: confidence >= CONFIDENCE_THRESHOLD && diagnosis.cause_type === 'data_side'
            ? 'approved' : 'needs_review',
          metadata: {
            crash_event_id: crash.id,
            diagnosis,
            occurrences: crash.occurrence_count,
            tokens,
          },
        })
      }

      console.log(`[AGENT-CTO] 🏥 Frontend crash diagnosis: ${results.length} crashes analyzed`)

      return new Response(JSON.stringify({
        success: true,
        crashes_analyzed: results.length,
        results,
      }), {
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
      'rankmath': 'rankmath-connector',
      'gtmetrix': 'gtmetrix-connector',
      'linkwhisper': 'linkwhisper-connector',
      'google-ads': 'google-ads-connector',
      'jargon-distance': 'audit-strategique-ia',
      'content-architecture': 'content-architecture-advisor',
      // Diagnostic functions
      'diag-content': 'cocoon-diag-content',
      'diag-semantic': 'cocoon-diag-semantic',
      'diag-structure': 'cocoon-diag-structure',
      'diag-authority': 'cocoon-diag-authority',
      // Strategist
      'strategist': 'cocoon-strategist',
      // Content Architect
      'content-architect': 'content-architecture-advisor',
      // Marina pipeline
      'marina': 'marina',
      'marina-report': 'marina',
      // Anomaly detection
      'anomaly-detection': 'detect-anomalies',
      // Frontend crashes
      'frontend-crash': 'frontend_crash',
    }
    const functionName = AUDIT_TYPE_TO_FUNCTION[auditType] || auditType

    // ─── Check if this function is enabled for CTO supervision ──────
    const { data: togglesConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'cto_function_toggles')
      .maybeSingle();
    
    const toggles = togglesConfig?.value as Record<string, boolean> | null;
    if (toggles && toggles[functionName] === false) {
      console.log(`[AGENT-CTO] ⏭️ Skipping ${functionName} — disabled by admin toggle`);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: `CTO supervision disabled for ${functionName}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Phase 1: Gather real evidence ──────────────────────────────
    const [champion, reliability] = await Promise.all([
      getChampionPrompt(supabase, functionName),
      getReliabilityProfile(supabase, functionName),
    ])

    const currentVersion = champion?.version || 0
    const currentPrompt = champion?.prompt_text || 'Aucun prompt enregistré — première analyse.'

    // Determine evidence basis — adaptive to available data sources
    // Sites without GSC/GA4 can still be evaluated using crawl + PageSpeed + audit data
    const hasGSC = reliability.snapshots_with_gsc >= 3
    const hasGA4 = reliability.snapshots_with_ga4 >= 2
    const hasEnoughSnapshots = reliability.total_snapshots >= 3

    let evidenceBasis: AgentDecision['evidence_basis'] = 'insufficient_data'
    if (reliability.snapshots_with_gsc >= 5 && reliability.total_snapshots >= 10) {
      evidenceBasis = 'real_data'
    } else if (hasGSC && hasGA4) {
      evidenceBasis = 'real_data'
    } else if (hasEnoughSnapshots) {
      // Sites without GSC/GA4: crawl data, PageSpeed, audit scores are valid heuristics
      evidenceBasis = 'heuristic'
    }

    const auditSummary = JSON.stringify(auditResult).substring(0, 6000)

    // ─── Phase 2: Build evidence-aware prompt ───────────────────────
    const systemPrompt = `Tu es un Agent CTO v2 spécialisé en SEO/GEO. Tu évalues la pertinence des audits en utilisant TOUTES les données disponibles.

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

SOURCES DE DONNÉES DISPONIBLES (par ordre de fiabilité) :
- Tier 1 (vérité terrain) : GSC (clics, impressions, CTR, positions) + GA4 (sessions, conversions)
- Tier 2 (données propriétaires) : Crawl multi-pages, audits techniques, PageSpeed, DataForSEO SERP
- Tier 3 (signaux indirects) : Score d'audit, recommandations appliquées, backlinks

RÈGLES D'ÉVALUATION ADAPTATIVES :
1. SI GSC+GA4 connectés : Évalue avec la rigueur maximale (corrélation données réelles). Seuil de confiance 95%.
2. SI GSC uniquement : Évalue avec les données GSC + crawl. Seuil de confiance 85%.
3. SI AUCUNE source Tier 1 connectée : Évalue en mode "audit technique pur" basé sur les données Tier 2+3 collectées par Crawlers (crawl, PageSpeed, SERP, scores d'audit). Seuil de confiance 70%. C'est un mode VALIDE — ne t'alarme PAS du manque de GSC/GA4, ces données ne sont simplement pas disponibles pour ce site. Concentre-toi sur ce que tu peux mesurer.
4. RÈGLE DES 10% : Max 10% de modification du prompt existant.
5. CORRÉLATION OBLIGATOIRE : Justifie par les données disponibles, pas par intuition.
6. Si "insufficient_data" (< 3 snapshots total), propose uniquement des observations.
7. NE DIS JAMAIS "impossible de valider" pour un site sans GSC/GA4 — adapte ton analyse aux données disponibles.

Réponds UNIQUEMENT en JSON :
{
  "analysis_summary": "Analyse basée sur les données disponibles",
  "self_critique": "Risques identifiés + biais potentiels",
  "confidence_score": 0-100,
  "proposed_change": "Nouveau prompt (null si aucun)",
  "change_diff_pct": 0-100,
  "data_driven_insights": "Ce que les données disponibles révèlent",
  "data_tier_used": "tier1|tier2|tier3"
}`

    const userPrompt = `FONCTION : ${functionName}
DOMAINE : ${domain || 'N/A'}
URL : ${url || 'N/A'}
SOURCES CONNECTÉES : ${hasGSC ? 'GSC ✓' : 'GSC ✗'} | ${hasGA4 ? 'GA4 ✓' : 'GA4 ✗'} | Crawl ✓ | PageSpeed ✓

PROMPT ACTUEL (v${currentVersion}) :
---
${currentPrompt}
---

RÉSULTAT DE L'AUDIT (tronqué) :
---
${auditSummary}
---

Analyse cet audit en utilisant les données disponibles. ${hasGSC ? 'Les métriques GSC constituent la vérité terrain principale.' : 'Sans GSC connectée, base ton évaluation sur les données techniques Crawlers (crawl, PageSpeed, scores d\'audit, SERP).'}${hasGA4 ? ' Les données GA4 enrichissent l\'analyse comportementale.' : ''}`

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
