import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: google-ads-connector
 * 
 * Handles Google Ads OAuth2 flow:
 * - POST action=login  → Returns OAuth2 authorization URL
 * - GET  (from Google) → Callback: exchanges code, stores tokens, redirects to frontend
 * - POST action=status → Returns connection status for the user
 * - POST action=disconnect → Removes the connection
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');

  const REDIRECT_URI = `${supabaseUrl}/functions/v1/google-ads-connector`;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Google OAuth credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
      try {
        const adsResp = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
          headers: { 
            Authorization: `Bearer ${tokens.access_token}`,
            'developer-token': 'test', // For listing accessible customers
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
    const { action, user_id, frontend_origin } = await req.json();

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
        return new Response(JSON.stringify({ error: 'Google Ads access requires full Google API access to be enabled by admin', code: 'FULL_ACCESS_DISABLED' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stateValue = `${user_id || ''}|${frontend_origin || ''}`;
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
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: conn } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, account_name, status, updated_at')
        .eq('user_id', user_id)
        .maybeSingle();

      return new Response(JSON.stringify({
        connected: !!conn,
        connection: conn || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DISCONNECT: Remove connection ===
    if (action === 'disconnect') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('user_id', user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Google Ads connector error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
