import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * gmb-actions — Router for Google Business Profile operations
 * 
 * Uses real GBP API when OAuth token is available,
 * falls back to simulated data otherwise.
 */

interface GmbTokenInfo {
  access_token: string
  account_id?: string
  location_id?: string
}

/** Resolve the Google token for a tracked site */
async function resolveGmbToken(userId: string, trackedSiteId: string): Promise<GmbTokenInfo | null> {
  const sb = getServiceClient()

  // 1. Check tracked_sites for explicit google_connection_id
  const { data: site } = await sb
    .from('tracked_sites')
    .select('google_connection_id, domain')
    .eq('id', trackedSiteId)
    .single()

  let connectionId = site?.google_connection_id

  // 2. If no explicit connection, look for a dedicated GBP connection (gbp: prefix)
  if (!connectionId) {
    const { data: gbpConns } = await sb
      .from('google_connections')
      .select('id, google_email, gmb_account_id, gmb_location_id')
      .eq('user_id', userId)
      .like('google_email', 'gbp:%')
      .limit(1)

    if (gbpConns && gbpConns.length > 0 && gbpConns[0].gmb_account_id) {
      connectionId = gbpConns[0].id
    }
  }

  // 3. If still no connection, scan google_connections for matching domain
  if (!connectionId && site?.domain) {
    const { data: conns } = await sb
      .from('google_connections')
      .select('id, site_url')
      .eq('user_id', userId)

    const match = conns?.find((c: any) => {
      const connDomain = (c.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
      return connDomain === site.domain || site.domain.includes(connDomain)
    })
    if (match) connectionId = match.id
  }

  if (!connectionId) return null

  // 3. Fetch the token
  const { data: conn } = await sb
    .from('google_connections')
    .select('access_token, refresh_token, token_expiry, scopes, gmb_account_id, gmb_location_id')
    .eq('id', connectionId)
    .single()

  if (!conn?.access_token) return null

  // 4. Check if token needs refresh
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    const refreshed = await refreshGoogleToken(conn.refresh_token, connectionId, sb)
    if (!refreshed) return null
    return { access_token: refreshed, account_id: conn.gmb_account_id, location_id: conn.gmb_location_id }
  }

  return { access_token: conn.access_token, account_id: conn.gmb_account_id, location_id: conn.gmb_location_id }
}

async function refreshGoogleToken(refreshToken: string, connectionId: string, sb: any): Promise<string | null> {
  try {
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
    if (!clientId || !clientSecret || !refreshToken) return null

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) return null
    const data = await res.json()

    // Update stored token
    await sb.from('google_connections').update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }).eq('id', connectionId)

    return data.access_token
  } catch {
    return null
  }
}

/** GBP API base */
const GBP_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_PERF = 'https://businessprofileperformance.googleapis.com/v1'
const GBP_REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4'

async function gbpFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GBP API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Real API handlers ──────────────────────────────────────

async function getPerformanceReal(token: GmbTokenInfo, params: any) {
  const locationName = `locations/${token.location_id}`
  const now = new Date()
  const startDate = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000) // 12 weeks

  const formatDate = (d: Date) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() })

  // Fetch multiple metrics
  const metrics = ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'WEBSITE_CLICKS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS']

  const url = `${GBP_PERF}/${locationName}:getDailyMetricsTimeSeries?` + new URLSearchParams({
    'dailyMetric': metrics.join(','),
    'dailyRange.startDate.year': String(startDate.getFullYear()),
    'dailyRange.startDate.month': String(startDate.getMonth() + 1),
    'dailyRange.startDate.day': String(startDate.getDate()),
    'dailyRange.endDate.year': String(now.getFullYear()),
    'dailyRange.endDate.month': String(now.getMonth() + 1),
    'dailyRange.endDate.day': String(now.getDate()),
  })

  try {
    const data = await gbpFetch(url, token.access_token)
    // Aggregate daily data into weekly buckets
    const weeklyMap = new Map<string, any>()
    
    for (const series of (data.timeSeries || [])) {
      const metric = series.dailyMetric
      for (const dp of (series.dailySubEntityResults?.[0]?.timeSeries?.datedValues || [])) {
        const d = new Date(dp.date.year, dp.date.month - 1, dp.date.day)
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay() + 1)
        const key = weekStart.toISOString().split('T')[0]
        
        if (!weeklyMap.has(key)) weeklyMap.set(key, { week_start_date: key, search_views: 0, maps_views: 0, website_clicks: 0, direction_requests: 0, phone_calls: 0 })
        const w = weeklyMap.get(key)
        const val = parseInt(dp.value || '0')
        
        if (metric.includes('SEARCH')) w.search_views += val
        else if (metric.includes('MAPS')) w.maps_views += val
        else if (metric === 'WEBSITE_CLICKS') w.website_clicks += val
        else if (metric === 'CALL_CLICKS') w.phone_calls += val
        else if (metric === 'BUSINESS_DIRECTION_REQUESTS') w.direction_requests += val
      }
    }

    const weekly = Array.from(weeklyMap.values()).sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))

    return {
      data: weekly,
      summary: {
        total_search_views: weekly.reduce((s, w) => s + w.search_views, 0),
        total_maps_views: weekly.reduce((s, w) => s + w.maps_views, 0),
        total_website_clicks: weekly.reduce((s, w) => s + w.website_clicks, 0),
        total_direction_requests: weekly.reduce((s, w) => s + w.direction_requests, 0),
        total_phone_calls: weekly.reduce((s, w) => s + w.phone_calls, 0),
      },
      simulated: false,
    }
  } catch (err) {
    console.warn('[gmb-actions] Performance API error, falling back to simulated:', err)
    return getPerformanceSimulated()
  }
}

async function getReviewsReal(token: GmbTokenInfo) {
  const accountName = `accounts/${token.account_id}`
  const locationName = `${accountName}/locations/${token.location_id}`
  
  try {
    const data = await gbpFetch(`${GBP_REVIEWS_BASE}/${locationName}/reviews?pageSize=50`, token.access_token)
    
    const reviews = (data.reviews || []).map((r: any) => ({
      id: r.reviewId || r.name?.split('/').pop(),
      reviewer_name: r.reviewer?.displayName || 'Utilisateur Google',
      star_rating: r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4 : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1,
      comment: r.comment || '',
      review_created_at: r.createTime,
      reply_comment: r.reviewReply?.comment || null,
      is_flagged: false,
    }))

    const avgRating = reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.star_rating, 0) / reviews.length : 0

    return { data: reviews, total: data.totalReviewCount || reviews.length, avg_rating: Math.round(avgRating * 10) / 10, simulated: false }
  } catch (err) {
    console.warn('[gmb-actions] Reviews API error, falling back to simulated:', err)
    return getReviewsSimulated()
  }
}

async function replyReviewReal(token: GmbTokenInfo, params: { reviewId: string; comment: string }) {
  const accountName = `accounts/${token.account_id}`
  const locationName = `${accountName}/locations/${token.location_id}`
  
  await gbpFetch(`${GBP_REVIEWS_BASE}/${locationName}/reviews/${params.reviewId}/reply`, token.access_token, {
    method: 'PUT',
    body: JSON.stringify({ comment: params.comment }),
  })
  return { success: true }
}

async function getLocationInfoReal(token: GmbTokenInfo) {
  try {
    const locationName = `locations/${token.location_id}`
    const data = await gbpFetch(`${GBP_BASE}/${locationName}?readMask=name,title,phoneNumbers,websiteUri,regularHours,categories,storefrontAddress`, token.access_token)
    
    return {
      data: {
        name: data.title || 'Mon Entreprise',
        address: formatAddress(data.storefrontAddress),
        phone: data.phoneNumbers?.primaryPhone || '',
        website: data.websiteUri || '',
        category: data.categories?.primaryCategory?.displayName || '',
        hours: formatHours(data.regularHours),
        verified: true,
      },
      simulated: false,
    }
  } catch (err) {
    console.warn('[gmb-actions] Location API error, falling back to simulated:', err)
    return getLocationInfoSimulated()
  }
}

function formatAddress(addr: any): string {
  if (!addr) return ''
  return [addr.addressLines?.join(', '), addr.locality, addr.postalCode, addr.regionCode].filter(Boolean).join(', ')
}

function formatHours(hours: any): Record<string, any> {
  if (!hours?.periods) return {}
  const dayMap: Record<string, string> = { MONDAY: 'monday', TUESDAY: 'tuesday', WEDNESDAY: 'wednesday', THURSDAY: 'thursday', FRIDAY: 'friday', SATURDAY: 'saturday', SUNDAY: 'sunday' }
  const result: Record<string, any> = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null }
  for (const p of hours.periods) {
    const day = dayMap[p.openDay]
    if (day) result[day] = { open: `${String(p.openTime?.hours || 0).padStart(2, '0')}:${String(p.openTime?.minutes || 0).padStart(2, '0')}`, close: `${String(p.closeTime?.hours || 0).padStart(2, '0')}:${String(p.closeTime?.minutes || 0).padStart(2, '0')}` }
  }
  return result
}

// ─── Simulated fallbacks ────────────────────────────────────

function getPerformanceSimulated() {
  const now = new Date()
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getTime() - (11 - i) * 7 * 24 * 60 * 60 * 1000)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay() + 1)
    return weekStart.toISOString().split('T')[0]
  })
  const data = weeks.map((week, i) => ({
    week_start_date: week,
    search_views: 120 + Math.floor(Math.random() * 80) + i * 5,
    maps_views: 80 + Math.floor(Math.random() * 60) + i * 3,
    website_clicks: 25 + Math.floor(Math.random() * 20) + i * 2,
    direction_requests: 8 + Math.floor(Math.random() * 12),
    phone_calls: 3 + Math.floor(Math.random() * 8),
    photo_views: 40 + Math.floor(Math.random() * 30) + i * 2,
  }))
  return {
    data,
    summary: {
      total_search_views: data.reduce((s, w) => s + w.search_views, 0),
      total_maps_views: data.reduce((s, w) => s + w.maps_views, 0),
      total_website_clicks: data.reduce((s, w) => s + w.website_clicks, 0),
      total_direction_requests: data.reduce((s, w) => s + w.direction_requests, 0),
      total_phone_calls: data.reduce((s, w) => s + w.phone_calls, 0),
      avg_rating: 4.3,
      total_reviews: 47,
    },
    simulated: true,
  }
}

function getReviewsSimulated() {
  return {
    data: [
      { id: '1', reviewer_name: 'Marie Dupont', star_rating: 5, comment: 'Excellent service, très professionnel !', review_created_at: '2026-03-10T10:00:00Z', reply_comment: 'Merci beaucoup Marie !', is_flagged: false },
      { id: '2', reviewer_name: 'Jean Martin', star_rating: 4, comment: 'Très bien dans l\'ensemble.', review_created_at: '2026-03-08T15:30:00Z', reply_comment: null, is_flagged: false },
      { id: '3', reviewer_name: 'Sophie Bernard', star_rating: 5, comment: 'Je recommande vivement !', review_created_at: '2026-03-05T09:15:00Z', reply_comment: 'Merci Sophie !', is_flagged: false },
      { id: '4', reviewer_name: 'Pierre Durand', star_rating: 2, comment: 'Accueil moyen.', review_created_at: '2026-03-01T14:00:00Z', reply_comment: null, is_flagged: false },
    ],
    total: 4,
    avg_rating: 4.0,
    simulated: true,
  }
}

function getLocationInfoSimulated() {
  return {
    data: {
      name: 'Mon Entreprise',
      address: '12 Rue de la Paix, 75002 Paris, France',
      phone: '+33 1 23 45 67 89',
      website: 'https://mon-entreprise.fr',
      category: 'Agence de communication',
      hours: {
        monday: { open: '09:00', close: '18:00' }, tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' }, thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '17:00' }, saturday: { open: '10:00', close: '13:00' }, sunday: null,
      },
      verified: true,
    },
    simulated: true,
  }
}

// ─── Main Router ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, tracked_site_id, ...params } = await req.json()

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user
    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!tracked_site_id) {
      return new Response(JSON.stringify({ error: 'tracked_site_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Resolve GBP token — fallback to simulated if unavailable
    const token = await resolveGmbToken(user.id, tracked_site_id)

    let result: any

    switch (action) {
      case 'get-performance':
        result = token ? await getPerformanceReal(token, params) : getPerformanceSimulated()
        break

      case 'get-reviews':
        result = token ? await getReviewsReal(token) : getReviewsSimulated()
        break

      case 'reply-review':
        if (!token) throw new Error('Google Business Profile connection required to reply to reviews')
        if (!params.reviewId || !params.comment) throw new Error('reviewId and comment required')
        result = await replyReviewReal(token, params as any)
        break

      case 'get-location-info':
        result = token ? await getLocationInfoReal(token) : getLocationInfoSimulated()
        break

      case 'get-posts':
        // Posts API not yet in GBP v1 — keep simulated
        result = {
          data: [
            { id: '1', post_type: 'STANDARD', summary: '🎉 Nouvelle collection printemps !', status: 'published', published_at: '2026-03-15T09:00:00Z' },
            { id: '2', post_type: 'EVENT', summary: '📅 Journée portes ouvertes le 22 mars.', status: 'published', published_at: '2026-03-10T10:00:00Z' },
          ],
          simulated: true,
        }
        break

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Log usage
    const sb = getServiceClient()
    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: `gmb:${action}`,
      event_data: { tracked_site_id, action, simulated: result?.simulated ?? false },
    }).catch(() => {})

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gmb-actions] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
