import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * gbp-auth — Separate Google Business Profile OAuth2 flow
 * 
 * Actions:
 *   POST action=login      → Returns OAuth2 auth URL (GBP-only scopes)
 *   GET  (from Google)      → Callback: exchanges code, stores tokens, redirects
 *   POST action=disconnect  → Removes GBP connection for user
 *   POST action=status      → Returns GBP connection status
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const REDIRECT_URI = `${supabaseUrl}/functions/v1/gbp-auth`

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Google credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = getServiceClient()

  // ═══════════ GET: OAuth callback from Google ═══════════
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') || ''
    const error = url.searchParams.get('error')

    const [userId, frontendOrigin] = state.split('|')
    const redirectBase = frontendOrigin || 'https://crawlers.lovable.app'

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gbp_error=${encodeURIComponent(error)}` },
      })
    }

    if (!code || !userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gbp_error=missing_code` },
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
          headers: { Location: `${redirectBase}/console?gbp_error=token_exchange_failed` },
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
        const accountsResp = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        )
        if (accountsResp.ok) {
          const { accounts = [] } = await accountsResp.json()
          if (accounts.length > 0) {
            gmbAccountId = accounts[0].name?.replace('accounts/', '') || null
            // Fetch first location
            if (gmbAccountId) {
              const locResp = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${gmbAccountId}/locations?readMask=name,title`,
                { headers: { Authorization: `Bearer ${tokens.access_token}` } }
              )
              if (locResp.ok) {
                const { locations = [] } = await locResp.json()
                if (locations.length > 0) {
                  gmbLocationId = locations[0].name?.split('/').pop() || null
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[gbp-auth] GBP discovery error:', e)
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
        headers: { Location: `${redirectBase}/console?gbp_connected=true&google_email=${encodeURIComponent(googleEmail)}` },
      })

    } catch (e) {
      console.error('[gbp-auth] callback error:', e)
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gbp_error=internal` },
      })
    }
  }

  // ═══════════ POST: API actions ═══════════
  try {
    const { action, user_id, frontend_origin } = await req.json()

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
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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
      await supabase.from('analytics_events').insert({
        user_id,
        event_type: 'gbp:disconnect',
        event_data: { deleted_count: gbpConns?.length || 0 },
      }).catch(() => {})

      return new Response(JSON.stringify({ success: true, deleted: gbpConns?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === STATUS: Check if user has GBP connection ===
    if (action === 'status') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: gbpConn } = await supabase
        .from('google_connections')
        .select('id, google_email, gmb_account_id, gmb_location_id, token_expiry')
        .eq('user_id', user_id)
        .like('google_email', 'gbp:%')
        .limit(1)
        .maybeSingle()

      return new Response(JSON.stringify({
        connected: !!gbpConn,
        email: gbpConn?.google_email?.replace('gbp:', '') || null,
        has_location: !!gbpConn?.gmb_location_id,
        token_valid: gbpConn?.token_expiry ? new Date(gbpConn.token_expiry) > new Date() : false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gbp-auth] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
