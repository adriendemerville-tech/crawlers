import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: fetch-ga4-data
 * 
 * Fetches Google Analytics 4 metrics using the GA4 Data API (v1beta).
 * Reuses the GSC OAuth tokens (which now include analytics.readonly scope).
 * 
 * Actions:
 * - list_properties: Lists GA4 properties accessible to the user
 * - fetch_metrics:   Fetches sessions, bounce rate, avg session duration, pageviews
 * - save_property:   Saves the user's selected GA4 property ID to their profile
 */

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'
const GA4_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

Deno.serve(handleRequest(async (req) => {
const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!
  const supabase = getServiceClient()
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  try {
    const body = await req.json()
    const { action, user_id: body_user_id, property_id, start_date, end_date, domain } = body
    const tracked_site_id: string | undefined = body.tracked_site_id
    const page_paths: string[] = Array.isArray(body.page_paths) ? body.page_paths : []
    const granularity: 'day' | 'week' | 'month' = body.granularity || 'day'
    const channel_group: string | undefined = body.channel_group
    const compare: boolean = body.compare === true
    const queryLimit: number = Math.min(Math.max(parseInt(body.limit) || 200, 1), 5000)

    // ─── SECURITY: Validate JWT and enforce real user_id ─────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const isServiceRole = serviceRoleKey && token === serviceRoleKey

    let user_id: string
    if (isServiceRole) {
      // Internal calls (cron, gsc-auth first pull) can specify user_id
      if (!body_user_id) return jsonError('user_id required for service calls', 400)
      user_id = body_user_id
    } else {
      // Regular user: extract from JWT, ignore body user_id
      const userClient = getUserClient(authHeader)
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return jsonError('Unauthorized', 401)
      user_id = user.id
    }

    // ─── Get & refresh access token ──────────────────────────────
    const accessToken = await getAccessToken(supabase, user_id, clientId, clientSecret)
    if (!accessToken) {
      return jsonError('GA4 not connected. User must reconnect GSC with analytics scope.', 401)
    }

    // ─── Action: list_properties ─────────────────────────────────
    if (action === 'list_properties') {
      const properties = await listGA4Properties(accessToken)
      return jsonOk({ success: true, properties })
    }

    // ─── Action: save_property ───────────────────────────────────
    if (action === 'save_property') {
      if (!property_id) {
        return jsonError('property_id required', 400)
      }
      await supabase.from('profiles').update({
        ga4_property_id: property_id,
      }).eq('user_id', user_id)

      return jsonOk({ success: true })
    }

    // ─── Action: fetch_metrics ───────────────────────────────────
    if (action === 'fetch_metrics') {
      // Resolve property ID: explicit > profile > auto-detect from domain
      let resolvedPropertyId = property_id
      if (!resolvedPropertyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('ga4_property_id')
          .eq('user_id', user_id)
          .single()
        resolvedPropertyId = profile?.ga4_property_id
      }

      if (!resolvedPropertyId && domain) {
        resolvedPropertyId = await autoDetectProperty(accessToken, domain)
        if (resolvedPropertyId) {
          // Auto-save for next time
          await supabase.from('profiles').update({
            ga4_property_id: resolvedPropertyId,
          }).eq('user_id', user_id)
        }
      }

      if (!resolvedPropertyId) {
        return jsonError('No GA4 property found. Use list_properties to find and save one.', 404)
      }

      const endD = end_date || new Date().toISOString().split('T')[0]
      const startD = start_date || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const metrics = await fetchGA4Metrics(accessToken, resolvedPropertyId, startD, endD)
      trackPaidApiCall('fetch-ga4-data', 'google-ga4', 'runReport')

      // Persist all GA4 data if a tracked_site is linked
      const domainForLookup = domain || ''
      let trackedSiteId: string | null = null
      if (domainForLookup) {
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('id')
          .eq('user_id', user_id)
          .ilike('domain', `%${domainForLookup.replace(/^www\./, '')}%`)
          .limit(1)
          .single()
        trackedSiteId = site?.id || null
      }

      if (trackedSiteId) {
        // Persist daily metrics
        if (metrics.daily_series?.length > 0) {
          await persistGA4DailyMetrics(supabase, user_id, trackedSiteId, metrics.daily_series)
          await persistGA4Revenue(supabase, user_id, trackedSiteId, metrics.daily_series)
        }
        // Persist top pages
        if (metrics.top_pages?.length > 0) {
          await persistGA4TopPages(supabase, user_id, trackedSiteId, startD, endD, metrics.top_pages)
        }
        // Persist behavioral metrics per page
        if (metrics.behavioral_pages?.length > 0) {
          await persistGA4BehavioralMetrics(supabase, user_id, trackedSiteId, startD, endD, metrics.behavioral_pages)
        }
      }

      return jsonOk({ success: true, property_id: resolvedPropertyId, ...metrics })
    }

    // ─── Action: list_pages (DB-first, lit ga4_behavioral_metrics) ────
    if (action === 'list_pages') {
      const { tracked_site_id, start, end, limit = 200 } = await readExtraParams(req as any)
      const siteId = tracked_site_id ?? body_user_id /* unused fallback */;
      const { tracked_site_id: tsi2, start: s2, end: e2 } = arguments[0] as any || {}
      // Use vars from main body
      const startD = start_date || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
      const endD = end_date || new Date().toISOString().split('T')[0]
      const trackedSiteId = (await safeJson(req)).tracked_site_id
      const { data: rows } = await supabase
        .from('ga4_behavioral_metrics')
        .select('page_path, pageviews:engaged_sessions, sessions:engaged_sessions')
        .eq('user_id', user_id)
        .eq('tracked_site_id', trackedSiteId)
        .gte('period_start', startD)
        .lte('period_end', endD)
        .limit(limit)
      const paths = Array.from(new Set((rows || []).map((r: any) => r.page_path))).sort()
      return jsonOk({ success: true, pages: paths })
    }

    return jsonError('Unknown action. Use: list_properties, save_property, fetch_metrics, fetch_timeseries, fetch_traffic_sources, list_pages, detect_anomalies', 400)
  } catch (err) {
    console.error('[fetch-ga4-data] Error:', err)
    return jsonError(err.message, 500)
  }
}))


// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

async function getAccessToken(supabase: any, userId: string, clientId: string, clientSecret: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry')
    .eq('user_id', userId)
    .single()

  if (!profile?.gsc_access_token) return null

  let accessToken = profile.gsc_access_token

  if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
    if (!profile.gsc_refresh_token) return null

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
    if (!resp.ok) return null
    const data = await resp.json()
    accessToken = data.access_token

    await supabase.from('profiles').update({
      gsc_access_token: accessToken,
      gsc_token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }).eq('user_id', userId)
  }

  return accessToken
}

async function listGA4Properties(accessToken: string): Promise<any[]> {
  // List all GA4 accounts, then properties
  const accountsResp = await fetch(`${GA4_ADMIN_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!accountsResp.ok) {
    const err = await accountsResp.text()
    console.error('[GA4] Failed to list accounts:', err)
    return []
  }
  const { accounts = [] } = await accountsResp.json()

  const allProperties: any[] = []
  for (const account of accounts) {
    const propsResp = await fetch(`${GA4_ADMIN_API}/${account.name}/properties?filter=parent:${account.name}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // Alternative: list all properties accessible
    if (propsResp.ok) {
      const { properties = [] } = await propsResp.json()
      for (const prop of properties) {
        allProperties.push({
          property_id: prop.name?.replace('properties/', ''),
          display_name: prop.displayName,
          website_url: prop.industryCategory || '',
          create_time: prop.createTime,
        })
      }
    }
  }

  // Also try the flat listing endpoint
  if (allProperties.length === 0) {
    const flatResp = await fetch(`${GA4_ADMIN_API}/properties?filter=ancestor:accounts/-`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (flatResp.ok) {
      const { properties = [] } = await flatResp.json()
      for (const prop of properties) {
        allProperties.push({
          property_id: prop.name?.replace('properties/', ''),
          display_name: prop.displayName,
          website_url: prop.industryCategory || '',
          create_time: prop.createTime,
        })
      }
    }
  }

  return allProperties
}

async function autoDetectProperty(accessToken: string, domain: string): Promise<string | null> {
  const properties = await listGA4Properties(accessToken)
  const bare = domain.replace(/^www\./, '').toLowerCase()

  // Try matching by display name containing the domain
  const match = properties.find((p: any) =>
    p.display_name?.toLowerCase().includes(bare) ||
    p.website_url?.toLowerCase().includes(bare)
  )
  return match?.property_id || null
}

async function fetchGA4Metrics(accessToken: string, propertyId: string, startDate: string, endDate: string) {
  // Normalize: strip "properties/" prefix if already present to avoid double prefix
  const numericId = propertyId.replace(/^properties\//, '');
  // ─── Report 1: Core engagement metrics ─────────────────────────
  const coreResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
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
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
    }),
  })

  let coreMetrics: any = null
  if (coreResp.ok) {
    const data = await coreResp.json()
    const row = data.rows?.[0]
    if (row) {
      const vals = row.metricValues || []
      coreMetrics = {
        sessions: parseInt(vals[0]?.value || '0'),
        total_users: parseInt(vals[1]?.value || '0'),
        new_users: parseInt(vals[2]?.value || '0'),
        pageviews: parseInt(vals[3]?.value || '0'),
        avg_session_duration: parseFloat(vals[4]?.value || '0'),
        bounce_rate: parseFloat(vals[5]?.value || '0'),
        engaged_sessions: parseInt(vals[6]?.value || '0'),
        engagement_rate: parseFloat(vals[7]?.value || '0'),
        ecommerce_purchases: parseInt(vals[8]?.value || '0'),
        purchase_revenue: parseFloat(vals[9]?.value || '0'),
      }
    }
  } else {
    const err = await coreResp.text()
    console.error('[GA4] Core metrics error:', err)
  }

  // ─── Report 2: Daily time series ───────────────────────────────
  const dailyResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 90,
    }),
  })

  let dailySeries: any[] = []
  if (dailyResp.ok) {
    const data = await dailyResp.json()
    dailySeries = (data.rows || []).map((r: any) => ({
      date: r.dimensionValues?.[0]?.value,
      sessions: parseInt(r.metricValues?.[0]?.value || '0'),
      pageviews: parseInt(r.metricValues?.[1]?.value || '0'),
      users: parseInt(r.metricValues?.[2]?.value || '0'),
      revenue: parseFloat(r.metricValues?.[3]?.value || '0'),
    }))
  }

  // ─── Report 3: Top pages ───────────────────────────────────────
  const pagesResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    }),
  })

  let topPages: any[] = []
  if (pagesResp.ok) {
    const data = await pagesResp.json()
    topPages = (data.rows || []).map((r: any) => ({
      path: r.dimensionValues?.[0]?.value,
      pageviews: parseInt(r.metricValues?.[0]?.value || '0'),
      avg_duration: parseFloat(r.metricValues?.[1]?.value || '0'),
      bounce_rate: parseFloat(r.metricValues?.[2]?.value || '0'),
    }))
  }

  // ─── Report 4: Behavioral metrics per page (scroll, clicks, conversions, engagement) ──
  const behavioralResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'userEngagementDuration' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'eventCount' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'conversions' },
      ],
      dimensionFilter: undefined,
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 50,
    }),
  })

  let behavioralPages: any[] = []
  if (behavioralResp.ok) {
    const data = await behavioralResp.json()
    behavioralPages = (data.rows || []).map((r: any) => {
      const sessions = parseInt(r.metricValues?.[5]?.value || '1') || 1
      const pageviews = parseInt(r.metricValues?.[4]?.value || '0')
      const conversions = parseInt(r.metricValues?.[6]?.value || '0')
      return {
        path: r.dimensionValues?.[0]?.value,
        avg_engagement_time: parseFloat(r.metricValues?.[0]?.value || '0') / Math.max(sessions, 1),
        engaged_sessions: parseInt(r.metricValues?.[1]?.value || '0'),
        engagement_rate: parseFloat(r.metricValues?.[2]?.value || '0'),
        total_events: parseInt(r.metricValues?.[3]?.value || '0'),
        pageviews,
        sessions,
        conversions,
        conversion_rate: sessions > 0 ? (conversions / sessions) * 100 : 0,
      }
    })
  } else {
    const err = await behavioralResp.text()
    console.error('[GA4] Behavioral metrics error:', err)
  }

  // ─── Report 5: Scroll events per page ──────────────────────────
  const scrollResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'scroll', matchType: 'EXACT' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    }),
  })

  const scrollMap: Record<string, number> = {}
  if (scrollResp.ok) {
    const data = await scrollResp.json()
    for (const r of data.rows || []) {
      const path = r.dimensionValues?.[0]?.value
      if (path) scrollMap[path] = parseInt(r.metricValues?.[0]?.value || '0')
    }
}

/**
 * Persist GA4 behavioral metrics per page (engagement, scroll, clicks, conversions).
 */
async function persistGA4BehavioralMetrics(
  supabase: any,
  userId: string,
  trackedSiteId: string,
  startDate: string,
  endDate: string,
  behavioralPages: any[],
) {
  const rows = behavioralPages.map((p: any) => ({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    page_path: p.path,
    period_start: startDate,
    period_end: endDate,
    avg_engagement_time: p.avg_engagement_time || 0,
    engaged_sessions: p.engaged_sessions || 0,
    engagement_rate: p.engagement_rate || 0,
    scroll_events: p.scroll_events || 0,
    scroll_rate: p.scroll_rate || 0,
    click_events: p.click_events || 0,
    outbound_clicks: 0,
    conversions: p.conversions || 0,
    conversion_rate: p.conversion_rate || 0,
    form_submissions: 0,
    exit_rate: 0,
    entries: p.sessions || 0,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('ga4_behavioral_metrics')
      .upsert(rows, { onConflict: 'tracked_site_id,page_path,period_start,period_end' })
    if (error) console.error('[GA4] Behavioral metrics persist error:', error.message)
  }
}

  // ─── Report 6: Click events per page ───────────────────────────
  const clickResp = await fetch(`${GA4_API}/properties/${numericId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'click', matchType: 'EXACT' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    }),
  })

  const clickMap: Record<string, number> = {}
  if (clickResp.ok) {
    const data = await clickResp.json()
    for (const r of data.rows || []) {
      const path = r.dimensionValues?.[0]?.value
      if (path) clickMap[path] = parseInt(r.metricValues?.[0]?.value || '0')
    }
  }

  // Enrich behavioral pages with scroll & click data
  for (const bp of behavioralPages) {
    bp.scroll_events = scrollMap[bp.path] || 0
    bp.scroll_rate = bp.sessions > 0 ? (bp.scroll_events / bp.sessions) * 100 : 0
    bp.click_events = clickMap[bp.path] || 0
  }

  return {
    metrics: coreMetrics,
    daily_series: dailySeries,
    top_pages: topPages,
    behavioral_pages: behavioralPages,
    period: { start_date: startDate, end_date: endDate },
    measured_at: new Date().toISOString(),
  }
}

/**
 * Persist GA4 revenue data into revenue_events table.
 * Called after fetch_metrics when e-commerce data is available.
 */
async function persistGA4Revenue(
  supabase: any,
  userId: string,
  trackedSiteId: string,
  dailySeries: any[],
) {
  const revenueRows = dailySeries
    .filter((d: any) => d.revenue > 0)
    .map((d: any) => ({
      tracked_site_id: trackedSiteId,
      user_id: userId,
      source: 'ga4',
      amount: d.revenue,
      currency: 'USD',
      transaction_date: `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`,
      order_external_id: `ga4-daily-${d.date}`,
      raw_payload: { date: d.date, revenue: d.revenue },
    }))

  if (revenueRows.length > 0) {
    const { error } = await supabase
      .from('revenue_events')
      .upsert(revenueRows, { onConflict: 'tracked_site_id,source,order_external_id' })
    if (error) console.error('[GA4] Revenue persist error:', error.message)
  }
}

/**
 * Persist GA4 daily metrics (sessions, users, pageviews, revenue) into ga4_daily_metrics.
 */
async function persistGA4DailyMetrics(
  supabase: any,
  userId: string,
  trackedSiteId: string,
  dailySeries: any[],
) {
  const rows = dailySeries.map((d: any) => ({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    metric_date: `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`,
    sessions: d.sessions || 0,
    total_users: d.users || 0,
    pageviews: d.pageviews || 0,
    revenue: d.revenue || 0,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('ga4_daily_metrics')
      .upsert(rows, { onConflict: 'tracked_site_id,metric_date' })
    if (error) console.error('[GA4] Daily metrics persist error:', error.message)
  }
}

/**
 * Persist GA4 top pages with engagement data into ga4_top_pages.
 */
async function persistGA4TopPages(
  supabase: any,
  userId: string,
  trackedSiteId: string,
  startDate: string,
  endDate: string,
  topPages: any[],
) {
  const rows = topPages.map((p: any) => ({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    period_start: startDate,
    period_end: endDate,
    page_path: p.path,
    pageviews: p.pageviews || 0,
    avg_duration: p.avg_duration || 0,
    bounce_rate: p.bounce_rate || 0,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('ga4_top_pages')
      .upsert(rows, { onConflict: 'tracked_site_id,period_start,period_end,page_path' })
    if (error) console.error('[GA4] Top pages persist error:', error.message)
  }
}