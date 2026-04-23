import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * gbp-auth — Separate Google Business Profile OAuth2 flow
 * 
 * Actions:
 *   POST action=login      → Returns OAuth2 auth URL (GBP-only scopes)
 *   GET  (from Google)      → Callback: exchanges code, stores tokens, redirects
 *   POST action=disconnect  → Removes GBP connection for user
 *   POST action=status      → Returns GBP connection status
 */

Deno.serve(handleRequest(async (req) => {
const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const REDIRECT_URI = `${supabaseUrl}/functions/v1/gbp-auth`

  if (!clientId || !clientSecret) {
    return jsonError('Google credentials not configured', 500)
  }

  const supabase = getServiceClient()

  // ═══════════ GET: OAuth callback from Google ═══════════
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') || ''
    const error = url.searchParams.get('error')

    const [userId, frontendOrigin] = state.split('|')
    const redirectBase = frontendOrigin || 'https://crawlers.fr'

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?tab=gmb&gbp_error=${encodeURIComponent(error)}` },
      })
    }

    if (!code || !userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?tab=gmb&gbp_error=missing_code` },
      })
    }

    try {
      // Exchange code for tokens
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      })

      if (!tokenResp.ok) {
        const errText = await tokenResp.text()
        console.error('[gbp-auth] Token exchange failed:', errText)
        return new Response(null, {
          status: 302,
          headers: { Location: `${redirectBase}/console?tab=gmb&gbp_error=token_exchange_failed` },
        })
      }

      const tokens = await tokenResp.json()
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

      // Fetch Google email
      let googleEmail = 'unknown'
      try {
        const infoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (infoResp.ok) {
          const info = await infoResp.json()
          googleEmail = info.email || 'unknown'
        }
      } catch (_) { /* best effort */ }

      // Try to discover GBP account & location
      let gmbAccountId: string | null = null
      let gmbLocationId: string | null = null
      try {
        console.log('[gbp-auth] 🔍 Starting GBP account discovery...')
        const accountsResp = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        )
        console.log(`[gbp-auth] Accounts API status: ${accountsResp.status}`)
        if (accountsResp.ok) {
          const accountsBody = await accountsResp.json()
          const accounts = accountsBody.accounts || []
          console.log(`[gbp-auth] Found ${accounts.length} account(s):`, JSON.stringify(accounts.map((a: any) => ({ name: a.name, type: a.type, role: a.role }))))
          if (accounts.length > 0) {
            gmbAccountId = accounts[0].name?.replace('accounts/', '') || null
            console.log(`[gbp-auth] Using account: ${gmbAccountId}`)
            // Fetch first location
            if (gmbAccountId) {
              const locUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${gmbAccountId}/locations?readMask=name,title,storefrontAddress`
              console.log(`[gbp-auth] Fetching locations from: ${locUrl}`)
              const locResp = await fetch(locUrl, {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
              })
              console.log(`[gbp-auth] Locations API status: ${locResp.status}`)
              if (locResp.ok) {
                const locBody = await locResp.json()
                const locations = locBody.locations || []
                console.log(`[gbp-auth] Found ${locations.length} location(s):`, JSON.stringify(locations.map((l: any) => ({ name: l.name, title: l.title }))))
                if (locations.length > 0) {
                  gmbLocationId = locations[0].name?.split('/').pop() || null
                  console.log(`[gbp-auth] ✅ Selected location: ${gmbLocationId}`)
                } else {
                  console.warn('[gbp-auth] ⚠️ Account found but NO locations — user may need to create a GMB listing first')
                }
              } else {
                const locErr = await locResp.text()
                console.error(`[gbp-auth] ❌ Locations API error ${locResp.status}: ${locErr}`)
              }
            }
          } else {
            console.warn('[gbp-auth] ⚠️ No GMB accounts found for this Google account')
          }
        } else {
          const errBody = await accountsResp.text()
          console.error(`[gbp-auth] ❌ Accounts API error ${accountsResp.status}: ${errBody}`)
        }
      } catch (e) {
        console.error('[gbp-auth] GBP discovery error:', e)
      }

      // Upsert into google_connections with gbp-specific flag
      // Use a special google_email suffix to avoid collision with gsc-auth connections
      const gbpEmail = `gbp:${googleEmail}`

      await supabase.from('google_connections').upsert({
        user_id: userId,
        google_email: gbpEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry: expiresAt,
        scopes: ['https://www.googleapis.com/auth/business.manage'],
        gmb_account_id: gmbAccountId,
        gmb_location_id: gmbLocationId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_email' })

      // Auto-link tracked sites to this GBP connection
      const { data: conn } = await supabase
        .from('google_connections')
        .select('id')
        .eq('user_id', userId)
        .eq('google_email', gbpEmail)
        .single()

      if (conn) {
        // Link all user's tracked sites that don't already have a google_connection_id
        const { data: sites } = await supabase
          .from('tracked_sites')
          .select('id')
          .eq('user_id', userId)
          .is('google_connection_id', null)

        if (sites && sites.length > 0) {
          for (const site of sites) {
            await supabase
              .from('tracked_sites')
              .update({ google_connection_id: conn.id })
              .eq('id', site.id)
          }
        }
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?tab=gmb&gbp_connected=true&google_email=${encodeURIComponent(googleEmail)}` },
      })

    } catch (e) {
      console.error('[gbp-auth] callback error:', e)
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?tab=gmb&gbp_error=internal` },
      })
    }
  }

  // ═══════════ POST: API actions ═══════════
  try {
    const { action, user_id: body_user_id, frontend_origin } = await req.json()

    // ─── SECURITY: Validate JWT and enforce real user_id ─────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isServiceRole = serviceRoleKey && token === serviceRoleKey

    let user_id: string
    if (action === 'login') {
      // Login doesn't require auth yet
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

    // === LOGIN: Generate GBP-only OAuth URL ===
    if (action === 'login') {
      const stateValue = `${user_id || ''}|${frontend_origin || ''}`
      const scopes = [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.email',
      ]

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: stateValue,
      })

      return new Response(JSON.stringify({
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === DISCONNECT: Remove GBP connection ===
    if (action === 'disconnect') {
      if (!user_id) {
        return jsonError('user_id required', 400)
      }

      // Find and delete GBP-specific connections (prefixed with gbp:)
      const { data: gbpConns } = await supabase
        .from('google_connections')
        .select('id, google_email')
        .eq('user_id', user_id)
        .like('google_email', 'gbp:%')

      if (gbpConns && gbpConns.length > 0) {
        for (const conn of gbpConns) {
          // Unlink tracked sites using this connection
          await supabase
            .from('tracked_sites')
            .update({ google_connection_id: null })
            .eq('google_connection_id', conn.id)

          // Delete the connection
          await supabase
            .from('google_connections')
            .delete()
            .eq('id', conn.id)
        }
      }

      // Log event
      try {
        await supabase.from('analytics_events').insert({
          user_id,
          event_type: 'gbp:disconnect',
          event_data: { deleted_count: gbpConns?.length || 0 },
        })
      } catch (_) { /* best effort */ }

      return jsonOk({ success: true, deleted: gbpConns?.length || 0 })
    }

    // === STATUS: Check if user has GBP connection & fetch locations ===
    if (action === 'status') {
      if (!user_id) {
        return jsonError('user_id required', 400)
      }

      const { data: gbpConn } = await supabase
        .from('google_connections')
        .select('id, google_email, gmb_account_id, gmb_location_id, access_token, refresh_token, token_expiry')
        .eq('user_id', user_id)
        .like('google_email', 'gbp:%')
        .limit(1)
        .maybeSingle()

      if (!gbpConn) {
        return jsonOk({ connected: false, email: null, locations: [] })
      }

      // Refresh token if expired
      let accessToken = gbpConn.access_token
      if (gbpConn.token_expiry && new Date(gbpConn.token_expiry) <= new Date() && gbpConn.refresh_token) {
        try {
          const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: gbpConn.refresh_token,
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
            }).eq('id', gbpConn.id)
          }
        } catch (e) {
          console.warn('[gbp-auth] Token refresh failed:', e)
        }
      }

      // If gmb_account_id is null, retry discovery now that we have a valid token
      let accountId = gbpConn.gmb_account_id
      let locationId = gbpConn.gmb_location_id

      if (!accountId && accessToken) {
        console.log('[gbp-auth/status] 🔄 gmb_account_id is null — retrying discovery...')
        try {
          const acctResp = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          console.log(`[gbp-auth/status] Accounts API: ${acctResp.status}`)
          if (acctResp.ok) {
            const { accounts = [] } = await acctResp.json()
            console.log(`[gbp-auth/status] Found ${accounts.length} account(s)`)
            if (accounts.length > 0) {
              accountId = accounts[0].name?.replace('accounts/', '') || null
              console.log(`[gbp-auth/status] Using account: ${accountId}`)
              if (accountId) {
                const locResp = await fetch(
                  `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )
                if (locResp.ok) {
                  const { locations: locs = [] } = await locResp.json()
                  if (locs.length > 0) {
                    locationId = locs[0].name?.split('/').pop() || null
                    console.log(`[gbp-auth/status] ✅ Discovered location: ${locationId}`)
                  }
                }
                // Persist discovered IDs
                await supabase.from('google_connections').update({
                  gmb_account_id: accountId,
                  gmb_location_id: locationId,
                  updated_at: new Date().toISOString(),
                }).eq('id', gbpConn.id)
                console.log('[gbp-auth/status] ✅ Persisted account/location IDs')
              }
            }
          } else {
            console.warn('[gbp-auth/status] Accounts API failed:', await acctResp.text())
          }
        } catch (e) {
          console.warn('[gbp-auth/status] Discovery retry failed:', e)
        }
      }

      // Fetch real locations from GBP API and persist into gmb_locations
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

              // Upsert into gmb_locations — match by user_id + place_id or location_name
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
                  // Find user's first tracked site as default
                  const { data: sites } = await supabase.from('tracked_sites')
                    .select('id').eq('user_id', user_id).limit(1)
                  const trackedSiteId = sites?.[0]?.id
                  if (trackedSiteId) {
                    await supabase.from('gmb_locations').insert({
                      user_id: user_id,
                      tracked_site_id: trackedSiteId,
                      location_name: locationName,
                      place_id: null,
                      address: addressStr, phone, website, category,
                      attributes: { google_location_name: loc.name, account_id: accountId },
                    })
                    console.log(`[gbp-auth/status] Inserted gmb_location: ${locationName}`)
                  }
                }
              } catch (upsertErr) {
                console.warn('[gbp-auth/status] gmb_locations upsert error:', upsertErr)
              }
            }
          } else {
            console.warn('[gbp-auth] Locations fetch failed:', await locResp.text())
          }
        }
      } catch (e) {
        console.warn('[gbp-auth] Locations fetch error:', e)
      }

      return jsonOk({
        connected: true,
        email: gbpConn.google_email?.replace('gbp:', '') || null,
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
