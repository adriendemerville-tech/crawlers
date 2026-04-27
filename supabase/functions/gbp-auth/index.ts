import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * gbp-auth — Google Business Profile actions
 *
 * 🔁 COMPAT WRAPPER (since 2026-04-27)
 * Le flow OAuth Google Business Profile a été unifié dans `gsc-auth`.
 * Cette fonction conserve les actions métier propres à GBP (status enrichi avec
 * découverte des locations, refresh token, sync vers gmb_locations).
 *
 *   POST action=login      → Redirige vers gsc-auth avec modules=["gbp"]
 *   GET  (callback Google)  → Plus utilisé. Redirect vers gsc-auth callback (rétrocompat URL).
 *   POST action=disconnect  → Vide gmb_account_id/gmb_location_id sur google_connections
 *   POST action=status      → Découverte/refresh accounts + locations, sync gmb_locations
 *
 * NOTE: les anciennes lignes préfixées "gbp:" dans google_connections ont été
 * fusionnées dans la connexion principale du user (migration du 2026-04-27).
 */

Deno.serve(handleRequest(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return jsonError('Google credentials not configured', 500)
  }

  const supabase = getServiceClient()

  // ═══════════ GET: Legacy callback URL → forward to gsc-auth ═══════════
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const forward = `${supabaseUrl}/functions/v1/gsc-auth${url.search}`
    console.log('[gbp-auth] Legacy GET callback → forwarding to gsc-auth')
    return new Response(null, { status: 302, headers: { Location: forward } })
  }

  // ═══════════ POST: API actions ═══════════
  try {
    const { action, user_id: body_user_id, frontend_origin } = await req.json()

    // ─── SECURITY: Validate JWT ─────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isServiceRole = serviceRoleKey && token === serviceRoleKey

    let user_id: string
    if (action === 'login') {
      user_id = body_user_id || ''
    } else if (isServiceRole) {
      if (!body_user_id) return jsonError('user_id required for service calls', 400)
      user_id = body_user_id
    } else {
      const userClient = getUserClient(authHeader)
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return jsonError('Unauthorized', 401)
      user_id = user.id
    }

    // === LOGIN: delegate to unified gsc-auth ===
    if (action === 'login') {
      const resp = await fetch(`${supabaseUrl}/functions/v1/gsc-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          action: 'login',
          user_id,
          frontend_origin,
          modules: ['gsc', 'gmb'],
        }),
      })
      const data = await resp.json()
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === DISCONNECT: clear GMB-related fields on google_connections ===
    if (action === 'disconnect') {
      if (!user_id) return jsonError('user_id required', 400)

      const { data: conns } = await supabase
        .from('google_connections')
        .select('id, scopes')
        .eq('user_id', user_id)
        .or('gmb_account_id.not.is.null,gmb_location_id.not.is.null')

      let cleared = 0
      for (const conn of (conns || [])) {
        const newScopes = (conn.scopes || []).filter(
          (s: string) => s !== 'https://www.googleapis.com/auth/business.manage'
        )
        await supabase
          .from('google_connections')
          .update({
            gmb_account_id: null,
            gmb_location_id: null,
            scopes: newScopes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)
        cleared++
      }

      // Log event
      try {
        await supabase.from('analytics_events').insert({
          user_id,
          event_type: 'gbp:disconnect',
          event_data: { cleared },
        })
      } catch (_) { /* best effort */ }

      return jsonOk({ success: true, deleted: cleared })
    }

    // === STATUS: Check GBP connection & fetch locations ===
    if (action === 'status') {
      if (!user_id) return jsonError('user_id required', 400)

      const { data: gbpConn } = await supabase
        .from('google_connections')
        .select('id, google_email, gmb_account_id, gmb_location_id, access_token, refresh_token, token_expiry, scopes')
        .eq('user_id', user_id)
        .not('gmb_account_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Fallback: any connection with business.manage scope (account_id may be discovered later)
      const { data: gbpConnAlt } = !gbpConn ? await supabase
        .from('google_connections')
        .select('id, google_email, gmb_account_id, gmb_location_id, access_token, refresh_token, token_expiry, scopes')
        .eq('user_id', user_id)
        .contains('scopes', ['https://www.googleapis.com/auth/business.manage'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() : { data: null }

      const conn = gbpConn || gbpConnAlt
      if (!conn) {
        return jsonOk({ connected: false, email: null, locations: [] })
      }

      // Refresh token if expired
      let accessToken = conn.access_token
      if (conn.token_expiry && new Date(conn.token_expiry) <= new Date() && conn.refresh_token) {
        try {
          const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: conn.refresh_token,
              grant_type: 'refresh_token',
            }),
          })
          if (refreshResp.ok) {
            const newTokens = await refreshResp.json()
            accessToken = newTokens.access_token
            const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString()
            await supabase.from('google_connections').update({
              access_token: accessToken,
              token_expiry: newExpiry,
              updated_at: new Date().toISOString(),
            }).eq('id', conn.id)
          }
        } catch (e) {
          console.warn('[gbp-auth] Token refresh failed:', e)
        }
      }

      // Auto-discover gmb_account_id if missing
      let accountId = conn.gmb_account_id
      let locationId = conn.gmb_location_id
      // Capture Google API error to surface to UI (e.g. 429 RESOURCE_EXHAUSTED, 403 PERMISSION_DENIED)
      let googleApiError: { status: number; reason?: string; message?: string; raw?: string } | null = null

      if (!accountId && accessToken) {
        console.log('[gbp-auth/status] 🔄 Discovering accounts...')
        try {
          const acctResp = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (acctResp.ok) {
            const { accounts = [] } = await acctResp.json()
            if (accounts.length > 0) {
              accountId = accounts[0].name?.replace('accounts/', '') || null
              if (accountId) {
                const locResp = await fetch(
                  `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )
                if (locResp.ok) {
                  const { locations: locs = [] } = await locResp.json()
                  if (locs.length > 0) {
                    locationId = locs[0].name?.split('/').pop() || null
                  }
                } else {
                  const raw = await locResp.text().catch(() => '')
                  let parsed: any = null
                  try { parsed = JSON.parse(raw) } catch { /* ignore */ }
                  googleApiError = {
                    status: locResp.status,
                    reason: parsed?.error?.status || parsed?.error?.errors?.[0]?.reason,
                    message: parsed?.error?.message,
                    raw: raw.slice(0, 500),
                  }
                  console.error('[gbp-auth/status] ❌ Locations API error', googleApiError)
                }
                await supabase.from('google_connections').update({
                  gmb_account_id: accountId,
                  gmb_location_id: locationId,
                  updated_at: new Date().toISOString(),
                }).eq('id', conn.id)
              }
            }
          } else {
            const raw = await acctResp.text().catch(() => '')
            let parsed: any = null
            try { parsed = JSON.parse(raw) } catch { /* ignore */ }
            googleApiError = {
              status: acctResp.status,
              reason: parsed?.error?.status || parsed?.error?.errors?.[0]?.reason,
              message: parsed?.error?.message,
              raw: raw.slice(0, 500),
            }
            console.error('[gbp-auth/status] ❌ Accounts API error', googleApiError)
          }
        } catch (e) {
          console.warn('[gbp-auth/status] Discovery failed:', e)
          googleApiError = { status: 0, reason: 'NETWORK_ERROR', message: e instanceof Error ? e.message : String(e) }
        }
      }

      // Fetch locations and sync to gmb_locations
      const locations: Array<{id: string; location_name: string; address: string; phone: string; website: string; category: string}> = []
      try {
        if (accountId && accessToken) {
          const locResp = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (locResp.ok) {
            const { locations: apiLocs = [] } = await locResp.json()
            for (const loc of apiLocs) {
              const locId = loc.name?.split('/').pop() || ''
              const addr = loc.storefrontAddress
              const addressStr = addr ? [addr.addressLines?.[0], addr.locality, addr.postalCode, addr.regionCode].filter(Boolean).join(', ') : ''
              const phone = loc.phoneNumbers?.primaryPhone || ''
              const website = loc.websiteUri || ''
              const category = loc.categories?.primaryCategory?.displayName || ''
              const locationName = loc.title || 'Sans nom'

              locations.push({ id: locId, location_name: locationName, address: addressStr, phone, website, category })

              // Upsert into gmb_locations
              try {
                const { data: existing } = await supabase.from('gmb_locations')
                  .select('id')
                  .eq('user_id', user_id)
                  .eq('location_name', locationName)
                  .limit(1)

                if (existing && existing.length > 0) {
                  await supabase.from('gmb_locations').update({
                    address: addressStr, phone, website, category,
                    attributes: { google_location_name: loc.name, account_id: accountId },
                    updated_at: new Date().toISOString(),
                  }).eq('id', existing[0].id)
                } else {
                  const { data: sites } = await supabase.from('tracked_sites')
                    .select('id').eq('user_id', user_id).limit(1)
                  const trackedSiteId = sites?.[0]?.id
                  if (trackedSiteId) {
                    await supabase.from('gmb_locations').insert({
                      user_id,
                      tracked_site_id: trackedSiteId,
                      location_name: locationName,
                      place_id: null,
                      address: addressStr, phone, website, category,
                      attributes: { google_location_name: loc.name, account_id: accountId },
                    })
                  }
                }
              } catch (upsertErr) {
                console.warn('[gbp-auth/status] gmb_locations upsert error:', upsertErr)
              }
            }
          }
        }
      } catch (e) {
        console.warn('[gbp-auth] Locations fetch error:', e)
      }

      return jsonOk({
        connected: true,
        email: conn.google_email || null,
        has_location: locations.length > 0,
        locations,
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gbp-auth] error:', msg)
    return jsonError(msg, 500)
  }
}))
