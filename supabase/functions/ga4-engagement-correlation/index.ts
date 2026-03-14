import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * Edge Function: ga4-engagement-correlation
 * 
 * Correlates GA4 engagement metrics with GEO/LLM audit scores.
 * Used by:
 *  - Impact dashboard: shows ROI with real engagement data
 *  - Agent CTO: validates prompt changes with statistical evidence
 *  - Agent SEO: uses engagement deltas to prioritize pages
 * 
 * Can be called:
 *  - On-demand: POST { user_id, domain }
 *  - By measure-audit-impact (weekly CRON) for enrichment
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, domain, snapshot_id } = await req.json()

    if (!user_id || !domain) {
      return new Response(JSON.stringify({ error: 'user_id and domain required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!

    // ─── 1. Get access token + GA4 property ──────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry, ga4_property_id')
      .eq('user_id', user_id)
      .single()

    if (!profile?.gsc_access_token || !profile?.ga4_property_id) {
      return new Response(JSON.stringify({
        error: 'GA4 not configured',
        needs_ga4: !profile?.ga4_property_id,
        needs_gsc: !profile?.gsc_access_token,
      }), {
        status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let accessToken = profile.gsc_access_token
    if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
      if (!profile.gsc_refresh_token) {
        return new Response(JSON.stringify({ error: 'Token expired, reconnect GSC' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: profile.gsc_refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const tokens = await resp.json()
      accessToken = tokens.access_token
      await supabase.from('profiles').update({
        gsc_access_token: accessToken,
        gsc_token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      }).eq('user_id', user_id)
    }

    // ─── 2. Fetch GA4 engagement (last 28 days) ──────────────────
    const endDate = new Date().toISOString().split('T')[0]
    const startDate28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const startDate56 = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Current period + previous period for delta
    const [currentResp, previousResp] = await Promise.all([
      fetch(`${GA4_API}/properties/${profile.ga4_property_id}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDate28, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'engagedSessions' },
            { name: 'newUsers' },
          ],
        }),
      }),
      fetch(`${GA4_API}/properties/${profile.ga4_property_id}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDate56, endDate: startDate28 }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'engagedSessions' },
            { name: 'newUsers' },
          ],
        }),
      }),
    ])

    const parseMetrics = async (resp: Response) => {
      if (!resp.ok) return null
      const data = await resp.json()
      const row = data.rows?.[0]
      if (!row) return null
      const v = row.metricValues || []
      return {
        sessions: parseInt(v[0]?.value || '0'),
        total_users: parseInt(v[1]?.value || '0'),
        pageviews: parseInt(v[2]?.value || '0'),
        avg_session_duration: parseFloat(v[3]?.value || '0'),
        bounce_rate: parseFloat(v[4]?.value || '0'),
        engagement_rate: parseFloat(v[5]?.value || '0'),
        engaged_sessions: parseInt(v[6]?.value || '0'),
        new_users: parseInt(v[7]?.value || '0'),
      }
    }

    const current = await parseMetrics(currentResp)
    const previous = await parseMetrics(previousResp)

    if (!current) {
      return new Response(JSON.stringify({ error: 'Could not fetch GA4 data' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    trackPaidApiCall('ga4-engagement-correlation', 'google-ga4', 'runReport')

    // ─── 3. Get audit scores for this domain ─────────────────────
    const { data: snapshots } = await supabase
      .from('audit_impact_snapshots')
      .select('audit_scores, audit_type, gsc_baseline, gsc_t30, gsc_t60, gsc_t90, impact_score, reliability_grade, created_at')
      .eq('user_id', user_id)
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(10)

    // ─── 4. Get LLM visibility scores ────────────────────────────
    const { data: llmScores } = await supabase
      .from('llm_visibility_scores')
      .select('llm_name, score_percentage, week_start_date')
      .eq('user_id', user_id)
      .order('week_start_date', { ascending: false })
      .limit(20)

    // ─── 5. Compute correlation ──────────────────────────────────
    const deltas = previous ? {
      sessions: computeDelta(current.sessions, previous.sessions),
      users: computeDelta(current.total_users, previous.total_users),
      pageviews: computeDelta(current.pageviews, previous.pageviews),
      avg_duration: computeDelta(current.avg_session_duration, previous.avg_session_duration),
      bounce_rate: computeDelta(current.bounce_rate, previous.bounce_rate, true), // inverted: lower is better
      engagement_rate: computeDelta(current.engagement_rate, previous.engagement_rate),
    } : null

    // Engagement health score (0-100)
    const engagementScore = computeEngagementScore(current, deltas)

    // Cross-correlate with audit impact
    const latestSnapshot = snapshots?.[0]
    const auditCorrelation = latestSnapshot ? {
      audit_type: latestSnapshot.audit_type,
      audit_impact_score: latestSnapshot.impact_score,
      audit_reliability: latestSnapshot.reliability_grade,
      has_gsc_data: !!latestSnapshot.gsc_baseline,
      engagement_aligns_with_audit: alignmentCheck(engagementScore, latestSnapshot.impact_score),
    } : null

    // ─── 6. Store correlation result ─────────────────────────────
    const correlationResult = {
      ga4_current: current,
      ga4_previous: previous,
      ga4_deltas: deltas,
      engagement_score: engagementScore,
      audit_correlation: auditCorrelation,
      llm_visibility_summary: summarizeLLM(llmScores || []),
      computed_at: new Date().toISOString(),
    }

    // If snapshot_id provided, enrich that snapshot with GA4 data
    if (snapshot_id) {
      await supabase
        .from('audit_impact_snapshots')
        .update({
          correlation_data: {
            ...(latestSnapshot as any)?.correlation_data || {},
            ga4_engagement: correlationResult,
          },
        })
        .eq('id', snapshot_id)
    }

    return new Response(JSON.stringify({
      success: true,
      ...correlationResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[ga4-engagement-correlation] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function computeDelta(current: number, previous: number, inverted = false): { absolute: number; pct: number; direction: string } {
  const absolute = current - previous
  const pct = previous > 0 ? (absolute / previous) * 100 : 0
  const rawDirection = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'stable'
  const direction = inverted ? (rawDirection === 'up' ? 'down' : rawDirection === 'down' ? 'up' : 'stable') : rawDirection
  return { absolute: Math.round(absolute * 100) / 100, pct: Math.round(pct * 10) / 10, direction }
}

function computeEngagementScore(current: any, deltas: any): number {
  // Base score from engagement rate (0-100)
  let score = Math.min(100, current.engagement_rate * 100)

  // Bonus/penalty from trends
  if (deltas) {
    if (deltas.sessions.direction === 'up') score += Math.min(10, deltas.sessions.pct / 5)
    if (deltas.sessions.direction === 'down') score -= Math.min(10, Math.abs(deltas.sessions.pct) / 5)
    if (deltas.engagement_rate.direction === 'up') score += 5
    if (deltas.bounce_rate.direction === 'up') score += 5 // inverted, so 'up' = bounce went down = good
  }

  return Math.round(Math.max(0, Math.min(100, score)))
}

function alignmentCheck(engagementScore: number, auditImpactScore: number | null): string {
  if (auditImpactScore == null) return 'no_audit_data'
  const engNorm = engagementScore / 100
  const impNorm = (auditImpactScore + 100) / 200 // normalize from [-100,100] to [0,1]
  const diff = Math.abs(engNorm - impNorm)
  if (diff < 0.15) return 'strong_alignment'
  if (diff < 0.30) return 'moderate_alignment'
  return 'weak_alignment'
}

function summarizeLLM(scores: any[]): any {
  if (scores.length === 0) return null
  const byLLM: Record<string, number[]> = {}
  for (const s of scores) {
    if (!byLLM[s.llm_name]) byLLM[s.llm_name] = []
    byLLM[s.llm_name].push(s.score_percentage)
  }
  const summary: Record<string, { latest: number; avg: number; trend: string }> = {}
  for (const [llm, vals] of Object.entries(byLLM)) {
    const latest = vals[0]
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    const trend = vals.length > 1 ? (vals[0] > vals[vals.length - 1] ? 'improving' : vals[0] < vals[vals.length - 1] ? 'declining' : 'stable') : 'insufficient_data'
    summary[llm] = { latest, avg, trend }
  }
  return summary
}
