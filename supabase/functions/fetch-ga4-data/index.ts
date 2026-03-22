import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!
  const supabase = getServiceClient()

  try {
    const { action, user_id, property_id, start_date, end_date, domain } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Get & refresh access token ──────────────────────────────
    const accessToken = await getAccessToken(supabase, user_id, clientId, clientSecret)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'GA4 not connected. User must reconnect GSC with analytics scope.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: list_properties ─────────────────────────────────
    if (action === 'list_properties') {
      const properties = await listGA4Properties(accessToken)
      return new Response(JSON.stringify({ success: true, properties }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Action: save_property ───────────────────────────────────
    if (action === 'save_property') {
      if (!property_id) {
        return new Response(JSON.stringify({ error: 'property_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await supabase.from('profiles').update({
        ga4_property_id: property_id,
      }).eq('user_id', user_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
        return new Response(JSON.stringify({ 
          error: 'No GA4 property found. Use list_properties to find and save one.',
          needs_property_selection: true,
        }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const endD = end_date || new Date().toISOString().split('T')[0]
      const startD = start_date || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const metrics = await fetchGA4Metrics(accessToken, resolvedPropertyId, startD, endD)
      trackPaidApiCall('fetch-ga4-data', 'google-ga4', 'runReport')

      // Persist revenue data if a tracked_site is linked
      if (metrics.daily_series?.length > 0) {
        // Find tracked_site_id for this user + domain
        const domainForLookup = domain || ''
        if (domainForLookup) {
          const { data: site } = await supabase
            .from('tracked_sites')
            .select('id')
            .eq('user_id', user_id)
            .ilike('domain', `%${domainForLookup.replace(/^www\./, '')}%`)
            .limit(1)
            .single()
          if (site) {
            await persistGA4Revenue(supabase, user_id, site.id, metrics.daily_series)
          }
        }
      }

      return new Response(JSON.stringify({ success: true, property_id: resolvedPropertyId, ...metrics }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list_properties, save_property, fetch_metrics' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[fetch-ga4-data] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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
  // ─── Report 1: Core engagement metrics ─────────────────────────
  const coreResp = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
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
  const dailyResp = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
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
  const pagesResp = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
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

  return {
    metrics: coreMetrics,
    daily_series: dailySeries,
    top_pages: topPages,
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
      currency: 'USD', // GA4 returns in property currency
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
