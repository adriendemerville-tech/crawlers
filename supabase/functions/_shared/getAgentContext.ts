/**
 * getAgentContext — Centralized enriched context for CTO, SEO, and Supervisor agents.
 * 
 * Aggregates:
 * 1. SAV conversations & quality scores (user pain points, recurring issues)
 * 2. Technical error logs (injection failures, connector errors, silent errors)
 * 3. Anomaly alerts (traffic drops, metric anomalies)
 * 4. Cocoon errors (semantic graph issues)
 * 5. User activity signals (recent actions, feature usage)
 * 
 * Returns a compact prompt-injectable string + structured data.
 */

import { getServiceClient } from './supabaseClient.ts'

export interface AgentContextOptions {
  /** Which agent is requesting context — controls relevance filtering */
  agent: 'cto' | 'seo' | 'supervisor'
  /** Optional domain filter */
  domain?: string
  /** Lookback window in days (default: 7) */
  days?: number
  /** Max items per category (default: 10) */
  maxPerCategory?: number
}

export interface AgentContextResult {
  promptSnippet: string
  data: {
    savIssues: SavIssue[]
    technicalErrors: TechnicalError[]
    anomalies: AnomalyAlert[]
    cocoonErrors: CocoonError[]
    silentErrors: SilentError[]
  }
  stats: {
    totalSavConversations: number
    avgSavScore: number | null
    escalationRate: number
    technicalErrorCount: number
    anomalyCount: number
    cocoonErrorCount: number
    silentErrorCount: number
  }
}

interface SavIssue {
  id: string
  created_at: string
  message_count: number
  has_escalation: boolean
  last_user_message: string
  precision_score: number | null
}

interface TechnicalError {
  source: string
  error_message: string
  domain: string | null
  created_at: string
}

interface AnomalyAlert {
  metric_name: string
  severity: string
  direction: string
  change_pct: number | null
  domain: string
  detected_at: string
}

interface CocoonError {
  domain: string
  problem: string
  status: string
  created_at: string
}

interface SilentError {
  function_name: string
  operation: string
  error_message: string
  created_at: string
}

/**
 * Fetch enriched context for an agent.
 * All queries run in parallel for minimal latency.
 */
export async function getAgentContext(opts: AgentContextOptions): Promise<AgentContextResult> {
  const supabase = getServiceClient()
  const days = opts.days ?? 7
  const max = opts.maxPerCategory ?? 10
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Run all queries in parallel
  const [
    savConvosRes,
    savScoresRes,
    injectionErrorsRes,
    connectorErrorsRes,
    anomalyRes,
    cocoonErrorsRes,
    silentErrorsRes,
    patchEffectivenessRes,
    cocoonConvosRes,
  ] = await Promise.all([
    // 1. SAV conversations (recent, with message preview) — Félix only
    supabase
      .from('sav_conversations')
      .select('id, messages, phone_callback, created_at')
      .gte('created_at', since)
      .neq('assistant_type', 'cocoon')
      .order('created_at', { ascending: false })
      .limit(max),

    // 2. SAV quality scores
    supabase
      .from('sav_quality_scores')
      .select('precision_score, escalated_to_phone, repeated_intent_count, scored_at')
      .gte('scored_at', since)
      .order('scored_at', { ascending: false })
      .limit(50),

    // 3. Injection error logs (CMS deploy failures)
    supabase
      .from('injection_error_logs')
      .select('error_type, error_message, domain, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(max),

    // 4. Connector errors (GSC/GA4/GMB failures)
    supabase
      .from('log_connector_errors')
      .select('connector_type, error_message, domain, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(max),

    // 5. Anomaly alerts (traffic/metric anomalies)
    supabase
      .from('anomaly_alerts')
      .select('metric_name, severity, direction, change_pct, domain, detected_at')
      .gte('detected_at', since)
      .eq('is_dismissed', false)
      .order('detected_at', { ascending: false })
      .limit(max),

    // 6. Cocoon errors
    supabase
      .from('cocoon_errors')
      .select('domain, problem_description, status, created_at')
      .gte('created_at', since)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(max),

    // 7. Silent errors from analytics_events
    supabase
      .from('analytics_events')
      .select('event_data, created_at')
      .eq('event_type', 'silent_error')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(max),

    // 8. Patch effectiveness (feedback loop)
    supabase
      .from('patch_effectiveness')
      .select('target_function, agent_source, errors_before, errors_after, error_reduction_pct, is_effective, deployment_date')
      .order('created_at', { ascending: false })
      .limit(20),

    // 9. Stratège Cocoon conversations (user pain points from cocoon chat)
    supabase
      .from('sav_conversations')
      .select('id, messages, source_domain, created_at')
      .eq('assistant_type', 'cocoon')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(max),
  ])

  // Process SAV data
  const savConvos = savConvosRes.data || []
  const savScores = savScoresRes.data || []
  const savIssues: SavIssue[] = savConvos.map((c: any) => {
    const msgs = Array.isArray(c.messages) ? c.messages : []
    const userMsgs = msgs.filter((m: any) => m.role === 'user')
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1]?.content || '' : ''
    return {
      id: c.id,
      created_at: c.created_at,
      message_count: msgs.length,
      has_escalation: !!c.phone_callback,
      last_user_message: lastUserMsg.substring(0, 200),
      precision_score: null,
    }
  })

  const avgScore = savScores.length > 0
    ? Math.round(savScores.reduce((s: number, q: any) => s + (q.precision_score || 0), 0) / savScores.length)
    : null
  const escalations = savScores.filter((s: any) => s.escalated_to_phone).length
  const escalationRate = savConvos.length > 0 ? Math.round((escalations / savConvos.length) * 100) : 0

  // Process technical errors
  const technicalErrors: TechnicalError[] = [
    ...(injectionErrorsRes.data || []).map((e: any) => ({
      source: 'injection_cms',
      error_message: (e.error_message || e.error_type || '').substring(0, 200),
      domain: e.domain,
      created_at: e.created_at,
    })),
    ...(connectorErrorsRes.data || []).map((e: any) => ({
      source: `connector_${e.connector_type}`,
      error_message: (e.error_message || '').substring(0, 200),
      domain: e.domain,
      created_at: e.created_at,
    })),
  ]

  // Process anomalies
  const anomalies: AnomalyAlert[] = (anomalyRes.data || []).map((a: any) => ({
    metric_name: a.metric_name,
    severity: a.severity,
    direction: a.direction,
    change_pct: a.change_pct,
    domain: a.domain,
    detected_at: a.detected_at,
  }))

  // Process cocoon errors
  const cocoonErrors: CocoonError[] = (cocoonErrorsRes.data || []).map((e: any) => ({
    domain: e.domain,
    problem: (e.problem_description || '').substring(0, 200),
    status: e.status,
    created_at: e.created_at,
  }))

  // Process silent errors
  const silentErrors: SilentError[] = (silentErrorsRes.data || []).map((e: any) => ({
    function_name: e.event_data?.function_name || 'unknown',
    operation: e.event_data?.operation || 'unknown',
    error_message: (e.event_data?.error_message || '').substring(0, 200),
    created_at: e.created_at,
  }))

  // Process patch effectiveness
  const patchResults = (patchEffectivenessRes.data || []).map((p: any) => ({
    target_function: p.target_function,
    agent_source: p.agent_source,
    errors_before: p.errors_before,
    errors_after: p.errors_after,
    error_reduction_pct: p.error_reduction_pct,
    is_effective: p.is_effective,
    deployment_date: p.deployment_date,
  }))

  // Process cocoon conversations (Stratège user exchanges)
  const cocoonConvos = cocoonConvosRes.data || []
  const cocoonUserIssues = cocoonConvos.map((c: any) => {
    const msgs = Array.isArray(c.messages) ? c.messages : []
    const userMsgs = msgs.filter((m: any) => m.role === 'user')
    return {
      id: c.id,
      created_at: c.created_at,
      domain: c.source_domain || 'unknown',
      message_count: msgs.length,
      user_messages: userMsgs.slice(-3).map((m: any) => (m.content || '').substring(0, 200)),
    }
  })

  // Build prompt snippet based on agent type
  const promptSnippet = buildPromptSnippet(opts.agent, {
    savIssues, technicalErrors, anomalies, cocoonErrors, silentErrors,
    avgScore, escalationRate, days, patchResults, cocoonUserIssues,
  })

  return {
    promptSnippet,
    data: { savIssues, technicalErrors, anomalies, cocoonErrors, silentErrors },
    stats: {
      totalSavConversations: savConvos.length,
      avgSavScore: avgScore,
      escalationRate,
      technicalErrorCount: technicalErrors.length,
      anomalyCount: anomalies.length,
      cocoonErrorCount: cocoonErrors.length,
      silentErrorCount: silentErrors.length,
      cocoonConversationCount: cocoonConvos.length,
      patchEffectivenessRate: patchResults.length > 0
        ? Math.round(patchResults.filter((p: any) => p.is_effective).length / patchResults.length * 100)
        : null,
    },
  }
}

function buildPromptSnippet(
  agent: 'cto' | 'seo' | 'supervisor',
  ctx: {
    savIssues: SavIssue[]
    technicalErrors: TechnicalError[]
    anomalies: AnomalyAlert[]
    cocoonErrors: CocoonError[]
    silentErrors: SilentError[]
    avgScore: number | null
    escalationRate: number
    days: number
    patchResults: any[]
  },
): string {
  const lines: string[] = []
  lines.push(`\n# CONTEXTE OPÉRATIONNEL (${ctx.days} derniers jours)\n`)

  // SAV — relevant for all agents
  if (ctx.savIssues.length > 0) {
    lines.push(`## 📞 Retours SAV (${ctx.savIssues.length} conversations)`)
    lines.push(`Score moyen SAV : ${ctx.avgScore ?? 'N/A'}/100 | Taux d'escalade : ${ctx.escalationRate}%`)
    const escalated = ctx.savIssues.filter(s => s.has_escalation)
    if (escalated.length > 0) {
      lines.push(`⚠️ ${escalated.length} conversation(s) avec escalade téléphonique :`)
      for (const s of escalated.slice(0, 3)) {
        lines.push(`  - "${s.last_user_message}"`)
      }
    }
    // Show recent user complaints
    const recent = ctx.savIssues.slice(0, 5)
    lines.push(`Derniers messages utilisateurs :`)
    for (const s of recent) {
      lines.push(`  - [${s.created_at.substring(0, 10)}] "${s.last_user_message}"`)
    }
  }

  // Technical errors — most relevant for CTO and Supervisor
  if ((agent === 'cto' || agent === 'supervisor') && ctx.technicalErrors.length > 0) {
    lines.push(`\n## 🔴 Erreurs techniques (${ctx.technicalErrors.length})`)
    for (const e of ctx.technicalErrors.slice(0, 8)) {
      lines.push(`  - [${e.source}] ${e.domain || 'global'}: ${e.error_message}`)
    }
  }

  // Silent errors — CTO and Supervisor
  if ((agent === 'cto' || agent === 'supervisor') && ctx.silentErrors.length > 0) {
    lines.push(`\n## 🔕 Erreurs silencieuses (${ctx.silentErrors.length})`)
    // Group by function
    const grouped: Record<string, number> = {}
    for (const e of ctx.silentErrors) {
      grouped[e.function_name] = (grouped[e.function_name] || 0) + 1
    }
    for (const [fn, count] of Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      lines.push(`  - ${fn}: ${count} erreur(s)`)
    }
  }

  // Anomaly alerts — relevant for SEO and Supervisor
  if ((agent === 'seo' || agent === 'supervisor') && ctx.anomalies.length > 0) {
    lines.push(`\n## 📉 Anomalies détectées (${ctx.anomalies.length})`)
    for (const a of ctx.anomalies.slice(0, 5)) {
      const pct = a.change_pct ? ` (${a.change_pct > 0 ? '+' : ''}${a.change_pct}%)` : ''
      lines.push(`  - [${a.severity}] ${a.metric_name} ${a.direction}${pct} — ${a.domain}`)
    }
  }

  // Cocoon errors — relevant for SEO
  if ((agent === 'seo' || agent === 'supervisor') && ctx.cocoonErrors.length > 0) {
    lines.push(`\n## 🕸️ Erreurs Cocoon (${ctx.cocoonErrors.length})`)
    for (const e of ctx.cocoonErrors.slice(0, 5)) {
      lines.push(`  - ${e.domain}: ${e.problem}`)
    }
  }

  // Patch effectiveness feedback — relevant for all agents
  if (ctx.patchResults.length > 0) {
    const effective = ctx.patchResults.filter(p => p.is_effective).length
    const total = ctx.patchResults.length
    const rate = Math.round((effective / total) * 100)
    lines.push(`\n## 📊 Feedback Patchs Déployés (${total} mesurés)`)
    lines.push(`Taux d'efficacité global : ${rate}% (${effective}/${total} patchs ont réduit les erreurs ≥20%)`)
    
    // Show ineffective patches so agents learn from failures
    const failures = ctx.patchResults.filter(p => !p.is_effective)
    if (failures.length > 0) {
      lines.push(`⚠️ Patchs INEFFICACES (à éviter de reproduire) :`)
      for (const f of failures.slice(0, 5)) {
        lines.push(`  - ${f.target_function} [${f.agent_source}]: erreurs ${f.errors_before}→${f.errors_after} (${f.error_reduction_pct}%)`)
      }
    }

    // Show effective patches as positive reinforcement
    const successes = ctx.patchResults.filter(p => p.is_effective)
    if (successes.length > 0) {
      lines.push(`✅ Patchs EFFICACES (patterns à reproduire) :`)
      for (const s of successes.slice(0, 3)) {
        lines.push(`  - ${s.target_function} [${s.agent_source}]: erreurs ${s.errors_before}→${s.errors_after} (${s.error_reduction_pct}%)`)
      }
    }
  }

  return lines.length > 2 ? lines.join('\n') : ''
}
