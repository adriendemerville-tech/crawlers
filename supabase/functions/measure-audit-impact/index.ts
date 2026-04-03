import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { fetchGA4Engagement, type GA4Engagement } from '../_shared/fetchGA4.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * measure-audit-impact (CRON — weekly)
 * 
 * Phase 2+3 of the feedback loop:
 * - Finds snapshots due for measurement (next_measurement_at <= now)
 * - Re-pulls GSC + GA4 + DataForSEO + PageSpeed metrics
 * - Computes deltas and correlation scores
 * - Updates reliability grades per audit function
 */

// Singleton client via _shared/supabaseClient.ts
const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'

async function fetchGscForDomain(accessToken: string, domain: string): Promise<any> {
  const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!sitesResp.ok) { await sitesResp.text(); return null }

  const { siteEntry = [] } = await sitesResp.json()
  const bare = domain.replace(/^www\./, '').toLowerCase()
  const match = siteEntry.find((s: any) => {
    const su = s.siteUrl.toLowerCase()
    if (su === `sc-domain:${bare}`) return true
    return su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') === bare
  })
  if (!match) return null

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000)

  const resp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(match.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['date'],
        rowLimit: 1000,
      }),
    }
  )
  if (!resp.ok) return null
  const { rows = [] } = await resp.json()

  let totalClicks = 0, totalImpressions = 0, totalPosition = 0, totalCtr = 0
  for (const row of rows) {
    totalClicks += row.clicks || 0
    totalImpressions += row.impressions || 0
    totalPosition += row.position || 0
    totalCtr += row.ctr || 0
  }

  trackPaidApiCall('measure-audit-impact', 'google-gsc', 'searchAnalytics/query')

  return {
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    avg_ctr: rows.length > 0 ? totalCtr / rows.length : 0,
    avg_position: rows.length > 0 ? totalPosition / rows.length : 0,
    days_measured: rows.length,
    measured_at: new Date().toISOString(),
  }
}

// ─── Correlation algorithm ────────────────────────────────────────────
interface CorrelationInput {
  gscBaseline: any
  gscCurrent: any
  recosApplied: number
  totalRecos: number
  codeDeployed: boolean
  actionPlanProgress: number
}

interface CorrelationInputV2 extends CorrelationInput {
  ga4Baseline?: GA4Engagement | null
  ga4Current?: GA4Engagement | null
}

function computeCorrelation(input: CorrelationInputV2): { impact_score: number; reliability_grade: string; correlation_data: any } {
  const { gscBaseline, gscCurrent, recosApplied, totalRecos, codeDeployed, actionPlanProgress, ga4Baseline, ga4Current } = input

  if (!gscBaseline || !gscCurrent) {
    return {
      impact_score: 0,
      reliability_grade: 'N/A',
      correlation_data: { reason: 'no_gsc_data' },
    }
  }

  // ─── GSC Delta calculations ────────────────────────────────────
  const clicksDelta = gscCurrent.total_clicks - gscBaseline.total_clicks
  const clicksDeltaPct = gscBaseline.total_clicks > 0
    ? (clicksDelta / gscBaseline.total_clicks) * 100 : 0

  const impressionsDelta = gscCurrent.total_impressions - gscBaseline.total_impressions
  const impressionsDeltaPct = gscBaseline.total_impressions > 0
    ? (impressionsDelta / gscBaseline.total_impressions) * 100 : 0

  const ctrDelta = gscCurrent.avg_ctr - gscBaseline.avg_ctr
  const positionDelta = gscBaseline.avg_position - gscCurrent.avg_position

  const normalize = (delta: number, maxExpected: number) =>
    Math.max(-100, Math.min(100, (delta / maxExpected) * 100))

  const clicksScore = normalize(clicksDeltaPct, 50)
  const impressionsScore = normalize(impressionsDeltaPct, 50)
  const ctrScore = normalize(ctrDelta * 100, 5)
  const positionScore = normalize(positionDelta, 10)

  // ─── GA4 Delta calculations (NEW) ─────────────────────────────
  let ga4SessionsScore = 0
  let ga4EngagementScore = 0
  let ga4BounceScore = 0
  let hasGa4 = false
  const ga4Deltas: any = {}

  if (ga4Baseline && ga4Current) {
    hasGa4 = true

    // Sessions delta
    const sessionsDelta = ga4Current.sessions - ga4Baseline.sessions
    const sessionsDeltaPct = ga4Baseline.sessions > 0
      ? (sessionsDelta / ga4Baseline.sessions) * 100 : 0
    ga4SessionsScore = normalize(sessionsDeltaPct, 50)

    // Engagement rate delta (0-1 scale)
    const engDelta = (ga4Current.engagement_rate - ga4Baseline.engagement_rate) * 100 // to pp
    ga4EngagementScore = normalize(engDelta, 10) // ±10pp

    // Bounce rate delta (inverted: lower = better)
    const bounceDelta = (ga4Baseline.bounce_rate - ga4Current.bounce_rate) * 100
    ga4BounceScore = normalize(bounceDelta, 10)

    ga4Deltas.sessions = { absolute: sessionsDelta, pct: Math.round(sessionsDeltaPct * 10) / 10 }
    ga4Deltas.engagement_rate = { delta_pp: Math.round(engDelta * 10) / 10 }
    ga4Deltas.bounce_rate = { delta_pp: Math.round(-bounceDelta * 10) / 10, direction: bounceDelta > 0 ? 'improved' : 'declined' }
    ga4Deltas.avg_session_duration = {
      baseline: Math.round(ga4Baseline.avg_session_duration),
      current: Math.round(ga4Current.avg_session_duration),
    }
  }

  // ─── Blended impact score ─────────────────────────────────────
  // With GA4: rebalance weights to include engagement signals
  const weights = hasGa4 ? {
    clicks: 0.25,
    impressions: 0.15,
    ctr: 0.15,
    position: 0.15,
    ga4_sessions: 0.10,
    ga4_engagement: 0.10,
    ga4_bounce: 0.10,
  } : {
    clicks: 0.35,
    impressions: 0.20,
    ctr: 0.25,
    position: 0.20,
    ga4_sessions: 0,
    ga4_engagement: 0,
    ga4_bounce: 0,
  }

  const rawImpact =
    clicksScore * weights.clicks +
    impressionsScore * weights.impressions +
    ctrScore * weights.ctr +
    positionScore * weights.position +
    ga4SessionsScore * weights.ga4_sessions +
    ga4EngagementScore * weights.ga4_engagement +
    ga4BounceScore * weights.ga4_bounce

  const effortMultiplier = totalRecos > 0
    ? 0.5 + 0.5 * (recosApplied / totalRecos)
    : 0.75
  const codeBonus = codeDeployed ? 1.1 : 1.0

  const impact_score = Math.round(Math.max(-100, Math.min(100, rawImpact * effortMultiplier * codeBonus)))

  let reliability_grade: string
  if (impact_score >= 30) reliability_grade = 'A'
  else if (impact_score >= 10) reliability_grade = 'B'
  else if (impact_score >= -10) reliability_grade = 'C'
  else if (impact_score >= -30) reliability_grade = 'D'
  else reliability_grade = 'F'

  return {
    impact_score,
    reliability_grade,
    correlation_data: {
      deltas: {
        clicks: { absolute: clicksDelta, pct: Math.round(clicksDeltaPct * 10) / 10 },
        impressions: { absolute: impressionsDelta, pct: Math.round(impressionsDeltaPct * 10) / 10 },
        ctr: { absolute: Math.round(ctrDelta * 10000) / 100, unit: 'pp' },
        position: { absolute: Math.round(positionDelta * 10) / 10, direction: positionDelta > 0 ? 'improved' : 'declined' },
        ...(hasGa4 ? { ga4: ga4Deltas } : {}),
      },
      scores: {
        clicks: Math.round(clicksScore),
        impressions: Math.round(impressionsScore),
        ctr: Math.round(ctrScore),
        position: Math.round(positionScore),
        ...(hasGa4 ? {
          ga4_sessions: Math.round(ga4SessionsScore),
          ga4_engagement: Math.round(ga4EngagementScore),
          ga4_bounce: Math.round(ga4BounceScore),
        } : {}),
      },
      weights,
      has_ga4: hasGa4,
      effort_multiplier: Math.round(effortMultiplier * 100) / 100,
      code_deployed: codeDeployed,
      action_plan_progress: Math.round(actionPlanProgress),
      computed_at: new Date().toISOString(),
    },
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient()

    // Find snapshots due for measurement
    const { data: pendingSnapshots, error: fetchErr } = await supabase
      .from('audit_impact_snapshots')
      .select('*')
      .neq('measurement_phase', 'complete')
      .lte('next_measurement_at', new Date().toISOString())
      .order('next_measurement_at', { ascending: true })
      .limit(20) // process max 20 per cron run

    if (fetchErr) throw fetchErr
    if (!pendingSnapshots?.length) {
      return jsonOk({ success: true, processed: 0, message: 'No pending measurements' })
    }

    console.log(`[measure] Processing ${pendingSnapshots.length} pending snapshots...`)

    let processed = 0
    let errors = 0

    for (const snapshot of pendingSnapshots) {
      try {
        // Get token via multi-account resolver
        const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
        const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!
        const resolved = await resolveGoogleToken(supabase, snapshot.user_id, snapshot.domain, clientId, clientSecret)
        let gscCurrent = null
        let ga4Current = null

        if (resolved) {
          gscCurrent = await fetchGscForDomain(resolved.access_token, snapshot.domain)

          // GA4 via shared helper
          if (resolved.ga4_property_id) {
            ga4Current = await fetchGA4Engagement({
              accessToken: resolved.access_token,
              propertyId: resolved.ga4_property_id,
            })
            if (ga4Current) {
              trackPaidApiCall('measure-audit-impact', 'google-ga4', 'runReport')
            }
          }
        }

        // Check current reco application status
        const [actionPlansRes, correctiveCodesRes] = await Promise.all([
          supabase.from('action_plans').select('tasks').eq('user_id', snapshot.user_id).eq('url', snapshot.url),
          supabase.from('saved_corrective_codes').select('validated_at').eq('user_id', snapshot.user_id).eq('url', snapshot.url),
        ])

        let actionPlanProgress = 0
        if (actionPlansRes.data?.length) {
          const allTasks = actionPlansRes.data.flatMap((ap: any) => Array.isArray(ap.tasks) ? ap.tasks : [])
          const completed = allTasks.filter((t: any) => t.completed || t.done).length
          actionPlanProgress = allTasks.length > 0 ? (completed / allTasks.length) * 100 : 0
        }
        const codeDeployed = correctiveCodesRes.data?.some((c: any) => c.validated_at != null) || false

        // Determine current phase and next phase
        const phaseMap: Record<string, { gscField: string; measuredField: string; nextPhase: string; nextDays: number | null }> = {
          baseline: { gscField: 'gsc_t30', measuredField: 'gsc_t30_measured_at', nextPhase: 't30', nextDays: 30 },
          t30: { gscField: 'gsc_t60', measuredField: 'gsc_t60_measured_at', nextPhase: 't60', nextDays: 30 },
          t60: { gscField: 'gsc_t90', measuredField: 'gsc_t90_measured_at', nextPhase: 't90', nextDays: 30 },
          t90: { gscField: '', measuredField: '', nextPhase: 'complete', nextDays: null },
        }

        const currentPhase = snapshot.measurement_phase || 'baseline'
        const phase = phaseMap[currentPhase]
        if (!phase) continue

        // Build update payload
        const updatePayload: any = {
          measurement_phase: phase.nextPhase,
          action_plan_progress: actionPlanProgress,
          corrective_code_deployed: codeDeployed,
          recos_applied_count: actionPlanProgress > 0 ? Math.round((actionPlanProgress / 100) * (snapshot.recommendations_count || 0)) : 0,
          updated_at: new Date().toISOString(),
        }

        // Store GSC + GA4 measurement for this phase
        if (phase.gscField && gscCurrent) {
          updatePayload[phase.gscField] = gscCurrent
          updatePayload[phase.measuredField] = new Date().toISOString()
        }
        // Store GA4 for this phase
        const ga4Field = phase.gscField?.replace('gsc_', 'ga4_')
        if (ga4Field && ga4Current) {
          updatePayload[ga4Field] = ga4Current
        }

        // ── GEO Visibility Snapshot ──────────────────────────────
        // Capture LLM visibility at each phase (baseline, t30, t60, t90)
        if (snapshot.tracked_site_id) {
          try {
            const geoResp = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/snapshot-geo-visibility`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  domain: snapshot.domain,
                  tracked_site_id: snapshot.tracked_site_id,
                  user_id: snapshot.user_id,
                  measurement_phase: currentPhase,
                  audit_impact_snapshot_id: snapshot.id,
                }),
              }
            )
            const geoResult = await geoResp.json()
            console.log(`[measure] GEO snapshot ${currentPhase}: score=${geoResult.overall_score}, delta=${geoResult.delta_overall_score}`)
          } catch (geoErr) {
            console.warn(`[measure] GEO snapshot failed for ${snapshot.domain}:`, geoErr)
          }
        }

        // Schedule next measurement
        if (phase.nextDays) {
          const next = new Date()
          next.setDate(next.getDate() + phase.nextDays)
          updatePayload.next_measurement_at = next.toISOString()
        } else {
          updatePayload.next_measurement_at = null
        }

        // If reaching T+90 or complete, compute final correlation with GA4
        if (phase.nextPhase === 'complete' || phase.nextPhase === 't90') {
          const latestGsc = gscCurrent || snapshot.gsc_t60 || snapshot.gsc_t30
          if (latestGsc && snapshot.gsc_baseline) {
            const correlation = computeCorrelation({
              gscBaseline: snapshot.gsc_baseline,
              gscCurrent: latestGsc,
              recosApplied: updatePayload.recos_applied_count,
              totalRecos: snapshot.recommendations_count || 0,
              codeDeployed,
              actionPlanProgress,
              // GA4 enrichment: compare baseline vs current
              ga4Baseline: snapshot.ga4_baseline as GA4Engagement | null,
              ga4Current: ga4Current || snapshot.ga4_t60 || snapshot.ga4_t30,
            })
            updatePayload.impact_score = correlation.impact_score
            updatePayload.reliability_grade = correlation.reliability_grade
            updatePayload.correlation_data = correlation.correlation_data
          }
        }

        await supabase
          .from('audit_impact_snapshots')
          .update(updatePayload)
          .eq('id', snapshot.id)

        console.log(`[measure] ✅ ${snapshot.domain} (${snapshot.audit_type}): ${currentPhase} → ${phase.nextPhase}`)
        processed++

      } catch (e) {
        console.error(`[measure] ❌ Error processing snapshot ${snapshot.id}:`, e)
        errors++
      }
    }

    return jsonOk({
      success: true,
      processed,
      errors,
      total_pending: pendingSnapshots.length,
    })

  } catch (error) {
    console.error('[measure] Fatal error:', error)
    await trackEdgeFunctionError('measure-audit-impact', error instanceof Error ? error.message : 'Unknown error').catch(() => {})
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})