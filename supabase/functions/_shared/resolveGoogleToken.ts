/**
 * resolveGoogleToken.ts
 * 
 * Shared helper: resolves the correct Google OAuth token for a given user + domain.
 * 
 * Resolution order:
 * 1. tracked_sites.google_connection_id → direct link
 * 2. google_connections.gsc_site_urls → auto-match domain in stored site list
 * 3. Fallback to profiles.gsc_access_token (legacy single-token)
 * 
 * Also handles token refresh automatically.
 */

interface ResolvedToken {
  access_token: string
  ga4_property_id: string | null
  connection_id: string | null
  source: 'connection_link' | 'connection_auto' | 'profile_legacy'
}

export async function resolveGoogleToken(
  supabase: any,
  userId: string,
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<ResolvedToken | null> {
  const bare = domain.replace(/^www\./, '').toLowerCase()

  // ─── Strategy 1: Direct link from tracked_site ─────────────────
  const { data: trackedSite } = await supabase
    .from('tracked_sites')
    .select('google_connection_id')
    .eq('user_id', userId)
    .eq('domain', domain)
    .single()

  if (trackedSite?.google_connection_id) {
    const { data: conn } = await supabase
      .from('google_connections')
      .select('*')
      .eq('id', trackedSite.google_connection_id)
      .single()

    if (conn) {
      const token = await ensureFreshToken(supabase, conn, clientId, clientSecret)
      if (token) {
        return {
          access_token: token,
          ga4_property_id: conn.ga4_property_id,
          connection_id: conn.id,
          source: 'connection_link',
        }
      }
    }
  }

  // ─── Strategy 2: Auto-match domain in gsc_site_urls ────────────
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)

  if (connections?.length) {
    for (const conn of connections) {
      const siteUrls: string[] = Array.isArray(conn.gsc_site_urls) ? conn.gsc_site_urls : []
      const matches = siteUrls.some((url: string) => {
        const cleaned = url.toLowerCase()
          .replace(/^sc-domain:/, '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/+$/, '')
        return cleaned === bare
      })

      if (matches) {
        const token = await ensureFreshToken(supabase, conn, clientId, clientSecret)
        if (token) {
          // Auto-link for next time
          if (trackedSite && !trackedSite.google_connection_id) {
            await supabase
              .from('tracked_sites')
              .update({ google_connection_id: conn.id })
              .eq('user_id', userId)
              .eq('domain', domain)
          }

          return {
            access_token: token,
            ga4_property_id: conn.ga4_property_id,
            connection_id: conn.id,
            source: 'connection_auto',
          }
        }
      }
    }
  }

  // ─── Strategy 3: Legacy fallback to profiles ───────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry, ga4_property_id')
    .eq('user_id', userId)
    .single()

  if (profile?.gsc_access_token) {
    let accessToken = profile.gsc_access_token

    if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
      if (!profile.gsc_refresh_token) return null
      const refreshed = await refreshOAuthToken(clientId, clientSecret, profile.gsc_refresh_token)
      if (!refreshed) return null
      accessToken = refreshed.access_token
      await supabase.from('profiles').update({
        gsc_access_token: accessToken,
        gsc_token_expiry: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
      }).eq('user_id', userId)
    }

    return {
      access_token: accessToken,
      ga4_property_id: profile.ga4_property_id,
      connection_id: null,
      source: 'profile_legacy',
    }
  }

  return null
}

// ─── Auto-detect & link: scan all connections' GSC properties for a domain
export async function autoLinkConnection(
  supabase: any,
  userId: string,
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const bare = domain.replace(/^www\./, '').toLowerCase()

  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)

  if (!connections?.length) return null

  for (const conn of connections) {
    const token = await ensureFreshToken(supabase, conn, clientId, clientSecret)
    if (!token) continue

    // Query GSC for this connection's sites
    const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) continue

    const { siteEntry = [] } = await resp.json()
    const match = siteEntry.find((s: any) => {
      const su = s.siteUrl.toLowerCase()
      if (su === `sc-domain:${bare}`) return true
      return su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') === bare
    })

    if (match) {
      // Update connection with discovered site URLs
      const existingUrls: string[] = Array.isArray(conn.gsc_site_urls) ? conn.gsc_site_urls : []
      if (!existingUrls.includes(match.siteUrl)) {
        await supabase
          .from('google_connections')
          .update({
            gsc_site_urls: [...existingUrls, match.siteUrl],
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)
      }

      // Link tracked site
      await supabase
        .from('tracked_sites')
        .update({ google_connection_id: conn.id })
        .eq('user_id', userId)
        .eq('domain', domain)

      return conn.id
    }
  }

  return null
}

// ─── Internal helpers ────────────────────────────────────────────────

async function ensureFreshToken(supabase: any, conn: any, clientId: string, clientSecret: string): Promise<string | null> {
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!conn.refresh_token) return null
    const refreshed = await refreshOAuthToken(clientId, clientSecret, conn.refresh_token)
    if (!refreshed) return null

    await supabase
      .from('google_connections')
      .update({
        access_token: refreshed.access_token,
        token_expiry: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)

    return refreshed.access_token
  }
  return conn.access_token
}

// ─── Circuit breaker state (module-level, persists across invocations) ───
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  isOpen(): boolean {
    if (this.failures < 3) return false
    // Open for 60s after 3+ consecutive failures
    return Date.now() - this.lastFailure < 60_000
  },
  recordFailure() {
    this.failures++
    this.lastFailure = Date.now()
  },
  recordSuccess() {
    this.failures = 0
  },
}

async function refreshOAuthToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    console.warn('[resolveGoogleToken] Circuit breaker OPEN — skipping refresh')
    return null
  }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [500, 1500] // ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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

      if (resp.ok) {
        circuitBreaker.recordSuccess()
        return resp.json()
      }

      const status = resp.status
      const body = await resp.text().catch(() => '')

      // Non-retryable: token revoked or invalid
      if (status === 400 || status === 401) {
        console.error(`[resolveGoogleToken] Token revoked/invalid (${status}): ${body.slice(0, 200)}`)
        circuitBreaker.recordFailure()
        return null
      }

      // Retryable: rate limit or server error
      if (attempt < MAX_RETRIES && (status === 429 || status >= 500)) {
        console.warn(`[resolveGoogleToken] Retry ${attempt + 1}/${MAX_RETRIES} after ${status}`)
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }

      console.error(`[resolveGoogleToken] Refresh failed (${status}): ${body.slice(0, 200)}`)
      circuitBreaker.recordFailure()
      return null
    } catch (err) {
      // Network error — retryable
      if (attempt < MAX_RETRIES) {
        console.warn(`[resolveGoogleToken] Network error, retry ${attempt + 1}/${MAX_RETRIES}: ${err}`)
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }
      console.error(`[resolveGoogleToken] Network error after retries: ${err}`)
      circuitBreaker.recordFailure()
      return null
    }
  }

  return null
}
