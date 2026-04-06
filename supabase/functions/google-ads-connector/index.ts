import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUserId } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: google-ads-connector
 * 
 * SECURITY NOTES:
 * - Scope used: adwords.readonly (read-only, no campaign mutations possible)
 * - The Google Ads API scope 'adwords' grants full access; we intentionally request
 *   'adwords.readonly' which restricts the token to GET/report operations only.
 * - On disconnect, we revoke the token at Google before deleting from DB.
 * - POST actions (login/status/disconnect) require JWT authentication.
 * 
 * Handles Google Ads OAuth2 flow:
 * - POST action=login  → Returns OAuth2 authorization URL
 * - GET  (from Google) → Callback: exchanges code, stores tokens, redirects to frontend
 * - POST action=status → Returns connection status for the user
 * - POST action=disconnect → Revokes token at Google + removes the connection
 */
Deno.serve(handleRequest(async (req) => {
const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  const REDIRECT_URI = `${supabaseUrl}/functions/v1/google-ads-connector`;

  if (!clientId || !clientSecret) {
    return jsonError('Google OAuth credentials not configured', 500);
  }

  const supabase = getServiceClient();

  // ═══════════════════════════════════════════════════════════════════
  // GET: Server-side OAuth callback from Google
  // ═══════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';
    const error = url.searchParams.get('error');

    const [userId, frontendOrigin] = state.split('|');
    const redirectBase = frontendOrigin || 'https://crawlers.lovable.app';

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gads_error=${encodeURIComponent(error)}` },
      });
    }

    if (!code || !userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gads_error=missing_code` },
      });
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
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        console.error('Google Ads token exchange failed:', errText);
        return new Response(null, {
          status: 302,
          headers: { Location: `${redirectBase}/console?gads_error=token_exchange_failed` },
        });
      }

      const tokens = await tokenResp.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Fetch Google email
      let googleEmail = 'unknown';
      try {
        const infoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (infoResp.ok) {
          const info = await infoResp.json();
          googleEmail = info.email || 'unknown';
        }
      } catch (_) { /* best effort */ }

      // Fetch Google Ads accounts (customer IDs)
      let customerId = '';
      let accountName = '';
      const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
      try {
        const adsResp = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
          headers: { 
            Authorization: `Bearer ${tokens.access_token}`,
            'developer-token': developerToken || '',
          },
        });
        if (adsResp.ok) {
          const adsData = await adsResp.json();
          const resourceNames: string[] = adsData.resourceNames || [];
          if (resourceNames.length > 0) {
            // Extract first customer ID from resource name "customers/1234567890"
            customerId = resourceNames[0].replace('customers/', '');
          }
        }
      } catch (e) {
        console.warn('Could not fetch Google Ads customers:', e);
      }

      // Store connection
      const { error: upsertError } = await supabase.from('google_ads_connections').upsert({
        user_id: userId,
        customer_id: customerId || `pending_${userId.substring(0, 8)}`,
        account_name: accountName || googleEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry: expiresAt,
        scopes: ['https://www.googleapis.com/auth/adwords.readonly'],
        status: customerId ? 'active' : 'pending_setup',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' } as any);

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        // Try insert instead
        await supabase.from('google_ads_connections').insert({
          user_id: userId,
          customer_id: customerId || `pending_${userId.substring(0, 8)}`,
          account_name: accountName || googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expiry: expiresAt,
          scopes: ['https://www.googleapis.com/auth/adwords.readonly'],
          status: customerId ? 'active' : 'pending_setup',
        });
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gads_connected=true&gads_email=${encodeURIComponent(googleEmail)}` },
      });

    } catch (e) {
      console.error('Google Ads callback error:', e);
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gads_error=internal` },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // POST: API calls (login, status, disconnect)
  // ═══════════════════════════════════════════════════════════════════
  try {
    // ── JWT Authentication ──
    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return jsonError('Authentication required', 401);
    }

    const { action, frontend_origin } = await req.json();
    // Use authenticated user ID instead of trusting client-provided user_id
    const user_id = authenticatedUserId;

    // === LOGIN: Generate OAuth URL ===
    if (action === 'login') {
      // Check if full Google access is enabled via system_config
      const { data: accessConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('config_key', 'full_google_access_auth')
        .maybeSingle();
      const fullGoogleAccess = accessConfig?.value && typeof accessConfig.value === 'object' && (accessConfig.value as any).active === true;
      if (!fullGoogleAccess) {
        return jsonError('Google Ads access requires full Google API access to be enabled by admin', 403);
      }

      const stateValue = `${user_id}|${frontend_origin || ''}`;
      const scopes = [
        'https://www.googleapis.com/auth/adwords.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ];

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: stateValue,
      });

      return new Response(JSON.stringify({
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === STATUS: Check connection ===
    if (action === 'status') {
      const { data: conn } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, account_name, status, updated_at')
        .eq('user_id', user_id)
        .maybeSingle();

      return jsonOk({
        connected: !!conn,
        connection: conn || null,
      });
    }

    // === DISCONNECT: Revoke token at Google + remove connection ===
    if (action === 'disconnect') {
      // 1. Fetch current token before deletion
      const { data: conn } = await supabase
        .from('google_ads_connections')
        .select('access_token, refresh_token')
        .eq('user_id', user_id)
        .maybeSingle();

      // 2. Revoke token at Google (best effort — don't block on failure)
      if (conn?.access_token) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          console.log(`[google-ads-connector] Token revoked for user ${user_id}`);
        } catch (revokeErr) {
          console.warn(`[google-ads-connector] Token revocation failed (non-blocking):`, revokeErr);
        }
      }

      // 3. Delete from database
      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('user_id', user_id);

      return jsonOk({ success: true, token_revoked: !!conn?.access_token });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Google Ads connector error:', e);
    return jsonError(e.message, 500);
  }
}));