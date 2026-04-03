import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * snapshot-audit-impact
 * 
 * Called after an audit completes for a GSC-connected user.
 * Captures baseline metrics (GSC, DataForSEO, PageSpeed) at T0
 * and schedules future measurements at T+30, T+60, T+90.
 */

// Singleton client via _shared/supabaseClient.ts

// ─── GSC helpers ──────────────────────────────────────────────────────
async function refreshGscToken(supabase: any, userId: string, clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  await supabase.from('profiles').update({
    gsc_access_token: data.access_token,
    gsc_token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
  }).eq('user_id', userId)
  return data.access_token
}

async function fetchGscMetrics(accessToken: string, siteUrl: string, domain: string): Promise<any> {
  // Resolve the site property
  const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  let resolvedUrl = siteUrl
  if (sitesResp.ok) {
    const { siteEntry = [] } = await sitesResp.json()
    const bare = domain.replace(/^www\./, '').toLowerCase()
    const match = siteEntry.find((s: any) => {
      const su = s.siteUrl.toLowerCase()
      if (su === `sc-domain:${bare}`) return true
      const cleaned = su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
      return cleaned === bare
    })
    if (match) resolvedUrl = match.siteUrl
    else return null // site not found in GSC
  } else {
    await sitesResp.text()
    return null
  }

  // Fetch last 28 days of search analytics
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000)

  const analyticsResp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedUrl)}/searchAnalytics/query`,
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
  if (!analyticsResp.ok) return null
  const { rows = [] } = await analyticsResp.json()

  let totalClicks = 0, totalImpressions = 0, totalPosition = 0, totalCtr = 0
  for (const row of rows) {
    totalClicks += row.clicks || 0
    totalImpressions += row.impressions || 0
    totalPosition += row.position || 0
    totalCtr += row.ctr || 0
  }

  // Also fetch top queries for deeper analysis
  const queriesResp = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 50,
      }),
    }
  )
  const topQueries = queriesResp.ok ? (await queriesResp.json()).rows || [] : []

  trackPaidApiCall('snapshot-audit-impact', 'google-gsc', 'searchAnalytics/query')

  return {
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    avg_ctr: rows.length > 0 ? totalCtr / rows.length : 0,
    avg_position: rows.length > 0 ? totalPosition / rows.length : 0,
    days_measured: rows.length,
    top_queries: topQueries.slice(0, 20).map((q: any) => ({
      query: q.keys?.[0],
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    })),
    measured_at: new Date().toISOString(),
  }
}

// ─── DataForSEO helper ────────────────────────────────────────────────
async function fetchDataForSeoBaseline(domain: string): Promise<any> {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')
  if (!login || !password) return null

  try {
    const resp = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${login}:${password}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain,
        language_code: 'fr',
        location_code: 2250, // France
        limit: 100,
      }]),
    })

    if (!resp.ok) return null
    const data = await resp.json()
    const result = data?.tasks?.[0]?.result?.[0]
    if (!result) return null

    trackPaidApiCall('snapshot-audit-impact', 'dataforseo', 'ranked_keywords/live')

    return {
      total_ranked: result.total_count || 0,
      top_3: result.items?.filter((i: any) => i.ranked_serp_element?.serp_item?.rank_absolute <= 3).length || 0,
      top_10: result.items?.filter((i: any) => i.ranked_serp_element?.serp_item?.rank_absolute <= 10).length || 0,
      top_50: result.items?.filter((i: any) => i.ranked_serp_element?.serp_item?.rank_absolute <= 50).length || 0,
      avg_position: result.metrics?.organic?.pos_1 != null
        ? Object.entries(result.metrics?.organic || {})
            .filter(([k]) => k.startsWith('pos_'))
            .reduce((sum, [, v]) => sum + (v as number), 0) / 
          Object.entries(result.metrics?.organic || {}).filter(([k]) => k.startsWith('pos_')).length
        : null,
      sample_keywords: result.items?.slice(0, 20).map((i: any) => ({
        keyword: i.keyword_data?.keyword,
        position: i.ranked_serp_element?.serp_item?.rank_absolute,
        search_volume: i.keyword_data?.keyword_info?.search_volume,
      })) || [],
      measured_at: new Date().toISOString(),
    }
  } catch (e) {
    console.error('[snapshot] DataForSEO error:', e)
    return null
  }
}

// ─── PageSpeed helper ─────────────────────────────────────────────────
async function fetchPageSpeedBaseline(url: string): Promise<any> {
  const apiKey = Deno.env.get('GOOGLE_PAGESPEED_API_KEY')
  if (!apiKey) return null

  try {
    const resp = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}&category=performance`
    )
    if (!resp.ok) return null
    const data = await resp.json()
    const metrics = data.lighthouseResult?.audits

    trackPaidApiCall('snapshot-audit-impact', 'google-pagespeed', 'runPagespeed')

    return {
      performance_score: Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100),
      lcp_ms: metrics?.['largest-contentful-paint']?.numericValue || null,
      fcp_ms: metrics?.['first-contentful-paint']?.numericValue || null,
      cls: metrics?.['cumulative-layout-shift']?.numericValue || null,
      ttfb_ms: metrics?.['server-response-time']?.numericValue || null,
      tbt_ms: metrics?.['total-blocking-time']?.numericValue || null,
      measured_at: new Date().toISOString(),
    }
  } catch (e) {
    console.error('[snapshot] PageSpeed error:', e)
    return null
  }
}

// ─── GA4 helper ───────────────────────────────────────────────────────
async function fetchGA4Baseline(accessToken: string, propertyId: string): Promise<any> {
  const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const resp = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'engagedSessions' },
        ],
      }),
    })

    if (!resp.ok) {
      console.error('[snapshot] GA4 error:', await resp.text())
      return null
    }

    const data = await resp.json()
    const row = data.rows?.[0]
    if (!row) return null

    const vals = row.metricValues || []
    trackPaidApiCall('snapshot-audit-impact', 'google-ga4', 'runReport')

    return {
      sessions: parseInt(vals[0]?.value || '0'),
      total_users: parseInt(vals[1]?.value || '0'),
      pageviews: parseInt(vals[2]?.value || '0'),
      avg_session_duration: parseFloat(vals[3]?.value || '0'),
      bounce_rate: parseFloat(vals[4]?.value || '0'),
      engagement_rate: parseFloat(vals[5]?.value || '0'),
      engaged_sessions: parseInt(vals[6]?.value || '0'),
      measured_at: new Date().toISOString(),
      period: { start_date: startDate, end_date: endDate },
    }
  } catch (e) {
    console.error('[snapshot] GA4 error:', e)
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
try {
    const { user_id, domain, url, audit_type, audit_scores, recommendations_count, recommendations_data, audit_report_id } = await req.json()

    if (!user_id || !domain || !audit_type) {
      return jsonError('Missing user_id, domain, or audit_type', 400)
    }

    const supabase = getServiceClient()

    // Get user profile for GSC + GA4 tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry, gsc_site_url, ga4_property_id')
      .eq('user_id', user_id)
      .single()

    // Find tracked site
    const { data: trackedSite } = await supabase
      .from('tracked_sites')
      .select('id')
      .eq('user_id', user_id)
      .eq('domain', domain)
      .single()

    // ─── Parallel data collection ────────────────────────────────────
    let gscBaseline = null
    let ga4Baseline = null

    // GSC + GA4: only if user has connected
    if (profile?.gsc_access_token) {
      const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
      const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!
      let accessToken = profile.gsc_access_token

      // Refresh if expired
      if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
        if (profile.gsc_refresh_token) {
          const refreshed = await refreshGscToken(supabase, user_id, clientId, clientSecret, profile.gsc_refresh_token)
          if (refreshed) accessToken = refreshed
        }
      }

      // Fetch GSC + GA4 in parallel
      const ga4Promise = profile.ga4_property_id
        ? fetchGA4Baseline(accessToken, profile.ga4_property_id)
        : Promise.resolve(null)

      const [gscResult, ga4Result] = await Promise.all([
        fetchGscMetrics(accessToken, profile.gsc_site_url || url, domain),
        ga4Promise,
      ])
      gscBaseline = gscResult
      ga4Baseline = ga4Result
    }

    // DataForSEO + PageSpeed in parallel
    const [dataforseoBaseline, pagespeedBaseline] = await Promise.all([
      fetchDataForSeoBaseline(domain),
      fetchPageSpeedBaseline(url),
    ])

    // Schedule next measurement at T+30
    const nextMeasurement = new Date()
    nextMeasurement.setDate(nextMeasurement.getDate() + 30)

    // Check if there are applied recos already
    const [actionPlansRes, correctiveCodesRes] = await Promise.all([
      supabase.from('action_plans').select('tasks').eq('user_id', user_id).eq('url', url),
      supabase.from('saved_corrective_codes').select('validated_at').eq('user_id', user_id).eq('url', url),
    ])

    // Calculate action plan progress
    let actionPlanProgress = 0
    if (actionPlansRes.data?.length) {
      const allTasks = actionPlansRes.data.flatMap((ap: any) => {
        const tasks = Array.isArray(ap.tasks) ? ap.tasks : []
        return tasks
      })
      const completed = allTasks.filter((t: any) => t.completed || t.done).length
      actionPlanProgress = allTasks.length > 0 ? (completed / allTasks.length) * 100 : 0
    }

    const hasDeployedCode = correctiveCodesRes.data?.some((c: any) => c.validated_at != null) || false

    // ─── Insert snapshot ─────────────────────────────────────────────
    const { data: snapshot, error } = await supabase
      .from('audit_impact_snapshots')
      .insert({
        user_id,
        tracked_site_id: trackedSite?.id || null,
        domain,
        url: url || `https://${domain}`,
        audit_type,
        audit_report_id: audit_report_id || null,
        audit_scores: audit_scores || {},
        recommendations_count: recommendations_count || 0,
        recommendations_data: recommendations_data || [],
        gsc_baseline: gscBaseline,
        ga4_baseline: ga4Baseline,
        dataforseo_baseline: dataforseoBaseline,
        pagespeed_baseline: pagespeedBaseline,
        action_plan_progress: actionPlanProgress,
        corrective_code_deployed: hasDeployedCode,
        next_measurement_at: nextMeasurement.toISOString(),
        measurement_phase: 'baseline',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[snapshot] Insert error:', error)
      throw error
    }

    const sourcesCollected = [
      gscBaseline ? 'GSC' : null,
      ga4Baseline ? 'GA4' : null,
      dataforseoBaseline ? 'DataForSEO' : null,
      pagespeedBaseline ? 'PageSpeed' : null,
    ].filter(Boolean)

    console.log(`[snapshot] ✅ Snapshot ${snapshot.id} created for ${domain} (${audit_type}) — sources: ${sourcesCollected.join(', ') || 'none'}`)

    return jsonOk({
      success: true,
      snapshot_id: snapshot.id,
      sources_collected: sourcesCollected,
      next_measurement: nextMeasurement.toISOString(),
      has_gsc: !!gscBaseline,
      has_ga4: !!ga4Baseline,
    })

  } catch (error) {
    console.error('[snapshot] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})