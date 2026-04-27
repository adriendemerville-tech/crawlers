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
    const force_refresh: boolean = body.force_refresh === true
    // TTL cache pour traffic sources (par défaut 6h, bornable 5min..24h)
    const cache_ttl_minutes: number = Math.min(Math.max(parseInt(body.cache_ttl_minutes) || 360, 5), 1440)

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

    // ═══════════════════════════════════════════════════════════════
    // GA4 EXPLORER actions (Console > Content > GA4 tab)
    // DB-first : lit ga4_daily_metrics + ga4_behavioral_metrics, fallback API
    // ═══════════════════════════════════════════════════════════════

    const endD = end_date || new Date().toISOString().split('T')[0]
    const startD = start_date || new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]

    // ─── Action: list_pages ───────────────────────────────────────
    if (action === 'list_pages') {
      if (!tracked_site_id) return jsonError('tracked_site_id required', 400)
      const { data: rows, error } = await supabase
        .from('ga4_behavioral_metrics')
        .select('page_path, pageviews, sessions, conversions')
        .eq('user_id', user_id)
        .eq('tracked_site_id', tracked_site_id)
        .gte('period_start', startD)
        .lte('period_end', endD)
        .limit(queryLimit)
      if (error) return jsonError(error.message, 500)
      const map = new Map<string, { path: string; pageviews: number; sessions: number; conversions: number }>()
      for (const r of rows || []) {
        const cur = map.get(r.page_path) || { path: r.page_path, pageviews: 0, sessions: 0, conversions: 0 }
        cur.pageviews += r.pageviews || 0
        cur.sessions += r.sessions || 0
        cur.conversions += r.conversions || 0
        map.set(r.page_path, cur)
      }
      const pages = Array.from(map.values()).sort((a, b) => b.pageviews - a.pageviews)
      return jsonOk({ success: true, pages })
    }

    // ─── Action: fetch_timeseries ─────────────────────────────────
    if (action === 'fetch_timeseries') {
      if (!tracked_site_id) return jsonError('tracked_site_id required', 400)

      // Aggregated daily series at site level (DB-first)
      const { data: daily, error: dailyErr } = await supabase
        .from('ga4_daily_metrics')
        .select('metric_date, sessions, total_users, pageviews, revenue')
        .eq('user_id', user_id)
        .eq('tracked_site_id', tracked_site_id)
        .gte('metric_date', startD)
        .lte('metric_date', endD)
        .order('metric_date', { ascending: true })
      if (dailyErr) return jsonError(dailyErr.message, 500)

      let series = (daily || []).map((r: any) => ({
        date: r.metric_date,
        sessions: r.sessions || 0,
        users: r.total_users || 0,
        pageviews: r.pageviews || 0,
        revenue: parseFloat(r.revenue || '0'),
        avg_engagement_time: 0,
        engagement_rate: 0,
      }))

      // Per-page series (when user filtered specific pages)
      let by_page: Record<string, any[]> | undefined
      if (page_paths.length > 0) {
        const { data: behavioral } = await supabase
          .from('ga4_behavioral_metrics')
          .select('page_path, period_start, period_end, pageviews, sessions, avg_engagement_time, engagement_rate, conversions')
          .eq('user_id', user_id)
          .eq('tracked_site_id', tracked_site_id)
          .in('page_path', page_paths)
          .gte('period_start', startD)
          .lte('period_end', endD)
        by_page = {}
        for (const path of page_paths) {
          const rowsForPath = (behavioral || []).filter((b: any) => b.page_path === path)
          by_page[path] = rowsForPath.map((b: any) => ({
            date: b.period_start,
            sessions: b.sessions || 0,
            pageviews: b.pageviews || 0,
            avg_engagement_time: parseFloat(b.avg_engagement_time || '0'),
            engagement_rate: parseFloat(b.engagement_rate || '0'),
            conversions: b.conversions || 0,
            users: 0,
          }))
        }
      }

      // Granularity aggregation (week / month) — done in JS for portability
      if (granularity !== 'day') {
        series = aggregateByPeriod(series, granularity)
        if (by_page) {
          for (const k of Object.keys(by_page)) {
            by_page[k] = aggregateByPeriod(by_page[k], granularity)
          }
        }
      }

      // Comparison previous period (same length)
      let compare_series: any[] | undefined
      if (compare && series.length > 0) {
        const days = Math.max(1, Math.ceil((new Date(endD).getTime() - new Date(startD).getTime()) / 86400000))
        const prevEnd = new Date(new Date(startD).getTime() - 86400000).toISOString().split('T')[0]
        const prevStart = new Date(new Date(startD).getTime() - (days + 1) * 86400000).toISOString().split('T')[0]
        const { data: prev } = await supabase
          .from('ga4_daily_metrics')
          .select('metric_date, sessions, total_users, pageviews, revenue')
          .eq('user_id', user_id)
          .eq('tracked_site_id', tracked_site_id)
          .gte('metric_date', prevStart)
          .lte('metric_date', prevEnd)
          .order('metric_date', { ascending: true })
        compare_series = (prev || []).map((r: any) => ({
          date: r.metric_date,
          sessions: r.sessions || 0,
          users: r.total_users || 0,
          pageviews: r.pageviews || 0,
          revenue: parseFloat(r.revenue || '0'),
        }))
        if (granularity !== 'day') compare_series = aggregateByPeriod(compare_series, granularity)
      }

      // KPI totals
      const totals = series.reduce((acc, r) => ({
        sessions: acc.sessions + r.sessions,
        users: acc.users + r.users,
        pageviews: acc.pageviews + r.pageviews,
        revenue: acc.revenue + (r.revenue || 0),
      }), { sessions: 0, users: 0, pageviews: 0, revenue: 0 })

      const compareTotals = compare_series?.reduce((acc, r) => ({
        sessions: acc.sessions + r.sessions,
        users: acc.users + r.users,
        pageviews: acc.pageviews + r.pageviews,
        revenue: acc.revenue + (r.revenue || 0),
      }), { sessions: 0, users: 0, pageviews: 0, revenue: 0 })

      return jsonOk({
        success: true,
        granularity,
        period: { start: startD, end: endD },
        series,
        by_page,
        compare_series,
        totals,
        compare_totals: compareTotals,
        cached_from: 'db',
      })
    }

    // ─── Action: fetch_traffic_sources ────────────────────────────
    // Stratégie : DB-first (cache TTL paramétrable) → fallback API GA4 live
    if (action === 'fetch_traffic_sources') {
      if (!tracked_site_id) return jsonError('tracked_site_id required', 400)

      // Empreinte stable du filtre pages (ordre indifférent)
      const sortedPaths = [...page_paths].sort()
      const pathsHash = sortedPaths.length === 0
        ? ''
        : await sha1(sortedPaths.join('|'))

      // 1) Lookup cache DB
      if (!force_refresh) {
        const { data: cached } = await supabase
          .from('ga4_traffic_sources_cache')
          .select('sources_data, fetched_at, expires_at')
          .eq('user_id', user_id)
          .eq('tracked_site_id', tracked_site_id)
          .eq('period_start', startD)
          .eq('period_end', endD)
          .eq('page_paths_hash', pathsHash)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (cached?.sources_data) {
          return jsonOk({
            success: true,
            sources: cached.sources_data,
            cached_from: 'db',
            fetched_at: cached.fetched_at,
            expires_at: cached.expires_at,
          })
        }
      }

      // 2) Fallback : appel GA4 live
      const { data: profile } = await supabase
        .from('profiles')
        .select('ga4_property_id')
        .eq('user_id', user_id)
        .single()
      const propId = property_id || profile?.ga4_property_id
      if (!propId) return jsonError('No GA4 property configured', 404)

      const dimFilter = page_paths.length > 0 ? {
        filter: {
          fieldName: 'pagePath',
          inListFilter: { values: page_paths },
        },
      } : undefined

      const resp = await fetch(`${GA4_API}/properties/${propId.replace(/^properties\//, '')}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: startD, endDate: endD }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          dimensionFilter: dimFilter,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 20,
        }),
      })
      if (!resp.ok) return jsonError(`GA4 API error: ${await resp.text()}`, resp.status)
      trackPaidApiCall('fetch-ga4-data', 'google-ga4', 'runReport-sources')
      const data = await resp.json()
      const sources = (data.rows || []).map((r: any) => ({
        channel: r.dimensionValues?.[0]?.value || '(unknown)',
        sessions: parseInt(r.metricValues?.[0]?.value || '0'),
        users: parseInt(r.metricValues?.[1]?.value || '0'),
      }))

      // 3) Upsert cache
      const fetchedAt = new Date()
      const expiresAt = new Date(fetchedAt.getTime() + cache_ttl_minutes * 60_000)
      await supabase
        .from('ga4_traffic_sources_cache')
        .upsert({
          user_id,
          tracked_site_id,
          period_start: startD,
          period_end: endD,
          page_paths_hash: pathsHash,
          page_paths: sortedPaths,
          sources_data: sources,
          fetched_at: fetchedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        }, { onConflict: 'tracked_site_id,period_start,period_end,page_paths_hash' })

      return jsonOk({
        success: true,
        sources,
        cached_from: 'live',
        fetched_at: fetchedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
    }

    // ─── Action: detect_anomalies ─────────────────────────────────
    // Z-score sur fenêtre glissante 14 jours, seuil |z| >= 2
    if (action === 'detect_anomalies') {
      if (!tracked_site_id) return jsonError('tracked_site_id required', 400)
      const { data: daily } = await supabase
        .from('ga4_daily_metrics')
        .select('metric_date, sessions, total_users, pageviews')
        .eq('user_id', user_id)
        .eq('tracked_site_id', tracked_site_id)
        .gte('metric_date', startD)
        .lte('metric_date', endD)
        .order('metric_date', { ascending: true })
      const anomalies = detectAnomalies((daily || []).map((r: any) => ({
        date: r.metric_date,
        sessions: r.sessions || 0,
        users: r.total_users || 0,
        pageviews: r.pageviews || 0,
      })))
      return jsonOk({ success: true, anomalies })
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
// ═══════════════════════════════════════════════════════════════════════
// GA4 Explorer helpers
// ═══════════════════════════════════════════════════════════════════════

/** Bucket date 'YYYY-MM-DD' to start-of-week (Monday) or start-of-month. */
function bucketKey(dateStr: string, granularity: 'week' | 'month'): string {
  const d = new Date(dateStr)
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  // week (ISO Monday)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().split('T')[0]
}

function aggregateByPeriod(series: any[], granularity: 'day' | 'week' | 'month'): any[] {
  if (granularity === 'day' || series.length === 0) return series
  const buckets = new Map<string, any>()
  for (const row of series) {
    const key = bucketKey(row.date, granularity)
    const cur = buckets.get(key) || { date: key, sessions: 0, users: 0, pageviews: 0, revenue: 0, conversions: 0, _count: 0, _sum_engagement_time: 0, _sum_engagement_rate: 0 }
    cur.sessions += row.sessions || 0
    cur.users += row.users || 0
    cur.pageviews += row.pageviews || 0
    cur.revenue += row.revenue || 0
    cur.conversions += row.conversions || 0
    cur._sum_engagement_time += row.avg_engagement_time || 0
    cur._sum_engagement_rate += row.engagement_rate || 0
    cur._count += 1
    buckets.set(key, cur)
  }
  return Array.from(buckets.values())
    .map((b) => ({
      date: b.date,
      sessions: b.sessions,
      users: b.users,
      pageviews: b.pageviews,
      revenue: b.revenue,
      conversions: b.conversions,
      avg_engagement_time: b._count ? b._sum_engagement_time / b._count : 0,
      engagement_rate: b._count ? b._sum_engagement_rate / b._count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Z-score anomaly detection on rolling 14-day window. Returns points with |z| >= 2. */
function detectAnomalies(series: { date: string; sessions: number; users: number; pageviews: number }[]) {
  const out: { date: string; metric: string; value: number; mean: number; z: number; direction: 'up' | 'down' }[] = []
  const metrics: Array<'sessions' | 'users' | 'pageviews'> = ['sessions', 'users', 'pageviews']
  const window = 14
  for (const metric of metrics) {
    for (let i = window; i < series.length; i++) {
      const slice = series.slice(i - window, i).map((r) => r[metric])
      const mean = slice.reduce((s, v) => s + v, 0) / slice.length
      const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length
      const std = Math.sqrt(variance)
      if (std === 0) continue
      const value = series[i][metric]
      const z = (value - mean) / std
      if (Math.abs(z) >= 2) {
        out.push({
          date: series[i].date,
          metric,
          value,
          mean: Math.round(mean),
          z: Math.round(z * 100) / 100,
          direction: z > 0 ? 'up' : 'down',
        })
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

// SHA-1 hex digest (used to fingerprint page_paths filter for cache key)
async function sha1(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-1', buf)
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
