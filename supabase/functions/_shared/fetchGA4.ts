/**
 * fetchGA4.ts — Shared GA4 Data API helper
 * 
 * Centralizes all GA4 API calls across edge functions.
 * Best-effort: returns null if token/property missing or API fails.
 */

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'

export interface GA4Engagement {
  sessions: number
  total_users: number
  bounce_rate: number
  engagement_rate: number
  avg_session_duration: number
  pageviews: number
  measured_at: string
}

export interface GA4FetchOptions {
  accessToken: string
  propertyId: string
  /** Number of days to look back (default: 28) */
  daysBack?: number
  /** Extra metrics beyond the standard set */
  extraMetrics?: string[]
}

/**
 * Fetch GA4 engagement metrics for a property.
 * Returns null on any failure (best-effort).
 */
export async function fetchGA4Engagement(opts: GA4FetchOptions): Promise<GA4Engagement | null> {
  const { accessToken, propertyId, daysBack = 28, extraMetrics = [] } = opts

  try {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const metrics = [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'bounceRate' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViews' },
      ...extraMetrics.map(name => ({ name })),
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const resp = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!resp.ok) return null

    const data = await resp.json()
    const row = data.rows?.[0]
    if (!row) return null

    const v = row.metricValues || []
    return {
      sessions: parseInt(v[0]?.value || '0'),
      total_users: parseInt(v[1]?.value || '0'),
      bounce_rate: parseFloat(v[2]?.value || '0'),
      engagement_rate: parseFloat(v[3]?.value || '0'),
      avg_session_duration: parseFloat(v[4]?.value || '0'),
      pageviews: parseInt(v[5]?.value || '0'),
      measured_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Convenience: resolve token + fetch GA4 in one call.
 * Returns null if no GA4 property configured.
 */
export async function fetchGA4ForDomain(
  supabase: any,
  userId: string,
  domain: string,
  resolveGoogleTokenFn: (supabase: any, userId: string, domain: string, clientId: string, clientSecret: string) => Promise<any>,
): Promise<GA4Engagement | null> {
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const resolved = await resolveGoogleTokenFn(supabase, userId, domain, clientId, clientSecret)
  if (!resolved?.ga4_property_id) return null

  return fetchGA4Engagement({
    accessToken: resolved.access_token,
    propertyId: resolved.ga4_property_id,
  })
}
