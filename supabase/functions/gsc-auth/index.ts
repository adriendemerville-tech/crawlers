import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: gsc-auth
 * 
 * Handles Google Search Console OAuth2 flow:
 * - action=login: Returns OAuth2 authorization URL
 * - action=callback: Exchanges code for tokens, stores in profile
 * - action=fetch: Uses stored tokens to fetch GSC data (30 days)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirect_uri, site_url, user_id } = await req.json();

    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Google GSC credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // === LOGIN: Generate OAuth URL ===
    if (action === 'login') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect_uri || `${supabaseUrl}/functions/v1/gsc-auth`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state: user_id || '',
      });

      return new Response(JSON.stringify({
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === CALLBACK: Exchange code for tokens ===
    if (action === 'callback') {
      if (!code || !user_id) {
        return new Response(JSON.stringify({ error: 'code and user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirect_uri || `${supabaseUrl}/functions/v1/gsc-auth`,
        }),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token exchange failed: ${errText}`);
      }

      const tokens = await tokenResp.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Store tokens in profile
      await supabase.from('profiles').update({
        gsc_access_token: tokens.access_token,
        gsc_refresh_token: tokens.refresh_token || null,
        gsc_token_expiry: expiresAt,
      }).eq('user_id', user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === FETCH: Get GSC data for last 30 days ===
    if (action === 'fetch') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user tokens
      const { data: profile } = await supabase
        .from('profiles')
        .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry, gsc_site_url')
        .eq('user_id', user_id)
        .single();

      if (!profile?.gsc_access_token) {
        return new Response(JSON.stringify({ error: 'GSC not connected' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let accessToken = profile.gsc_access_token;

      // Refresh token if expired
      if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
        if (!profile.gsc_refresh_token) {
          return new Response(JSON.stringify({ error: 'GSC token expired, please reconnect' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: profile.gsc_refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResp.ok) {
          return new Response(JSON.stringify({ error: 'Failed to refresh GSC token' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const newTokens = await refreshResp.json();
        accessToken = newTokens.access_token;

        await supabase.from('profiles').update({
          gsc_access_token: accessToken,
          gsc_token_expiry: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
        }).eq('user_id', user_id);
      }

      // Fetch GSC data
      const targetSite = site_url || profile.gsc_site_url;
      if (!targetSite) {
        return new Response(JSON.stringify({ error: 'No site URL configured' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const gscResp = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(targetSite)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dimensions: ['date'],
            rowLimit: 1000,
          }),
        }
      );

      if (!gscResp.ok) {
        const errText = await gscResp.text();
        throw new Error(`GSC API error: ${errText}`);
      }

      const gscData = await gscResp.json();

      // Compute totals
      let totalClicks = 0, totalImpressions = 0, totalPosition = 0;
      const rows = gscData.rows || [];
      for (const row of rows) {
        totalClicks += row.clicks || 0;
        totalImpressions += row.impressions || 0;
        totalPosition += row.position || 0;
      }

      return new Response(JSON.stringify({
        rows,
        total_clicks: totalClicks,
        total_impressions: totalImpressions,
        avg_position: rows.length > 0 ? totalPosition / rows.length : 0,
        date_range: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('gsc-auth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
