import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUserId } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: google-ads-connector
 *
 * 🔁 COMPAT WRAPPER (since 2026-04-27)
 * Le flow OAuth Google Ads a été unifié dans `gsc-auth` (endpoint OAuth Google global).
 * Cette fonction reste comme wrapper de compatibilité pour les anciens appels frontend
 * (et pour exposer les actions métier `status` / `disconnect` spécifiques à Ads).
 *
 * - POST action=login    → Redirige vers gsc-auth avec modules=["ads"] (incrémental, prompt=consent)
 * - GET  (callback Google) → Plus utilisé. Si appelé, redirect vers gsc-auth callback (rétrocompat URL)
 * - POST action=status   → Lit ads_customer_id sur google_connections (table unifiée)
 * - POST action=disconnect → Vide ads_* sur google_connections, ne touche pas aux autres scopes
 *
 * NOTE: la table google_ads_connections a été renommée google_ads_connections_deprecated_20260427.
 */
Deno.serve(handleRequest(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return jsonError('Google OAuth credentials not configured', 500);
  }

  const supabase = getServiceClient();

  // ═══════════════════════════════════════════════════════════════════
  // GET: Legacy callback URL (Google Cloud Console may still have it registered)
  // Forward to gsc-auth callback with the same query string.
  // ═══════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const forward = `${supabaseUrl}/functions/v1/gsc-auth${url.search}`;
    console.log('[google-ads-connector] Legacy GET callback → forwarding to gsc-auth');
    return new Response(null, { status: 302, headers: { Location: forward } });
  }

  // ═══════════════════════════════════════════════════════════════════
  // POST: API actions
  // ═══════════════════════════════════════════════════════════════════
  try {
    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return jsonError('Authentication required', 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, frontend_origin } = body;
    const user_id = authenticatedUserId;

    // === LOGIN: delegate to gsc-auth (unified OAuth) ===
    if (action === 'login') {
      // Vérifier le flag admin (gating Ads)
      const { data: accessConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'full_google_access_auth')
        .maybeSingle();
      const fullGoogleAccess = accessConfig?.value
        && typeof accessConfig.value === 'object'
        && (accessConfig.value as any).active === true;
      if (!fullGoogleAccess) {
        return jsonError('Google Ads access requires full Google API access to be enabled by admin', 403);
      }

      // Forward to unified endpoint
      const resp = await fetch(`${supabaseUrl}/functions/v1/gsc-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({
          action: 'login',
          user_id,
          frontend_origin,
          modules: ['gsc', 'ads'], // GSC gardé par défaut + Ads
        }),
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === STATUS: read from unified google_connections.ads_* ===
    if (action === 'status') {
      const { data: conn } = await supabase
        .from('google_connections')
        .select('id, google_email, ads_customer_id, ads_account_name, ads_status, scopes, updated_at')
        .eq('user_id', user_id)
        .not('ads_customer_id', 'is', null)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      return jsonOk({
        connected: !!conn?.ads_customer_id,
        connection: conn ? {
          id: conn.id,
          customer_id: conn.ads_customer_id,
          account_name: conn.ads_account_name || conn.google_email,
          status: conn.ads_status || 'active',
          updated_at: conn.updated_at,
        } : null,
      });
    }

    // === DISCONNECT: clear ads_* from google_connections (keep other scopes) ===
    if (action === 'disconnect') {
      // 1. Find connections that have Ads
      const { data: conns } = await supabase
        .from('google_connections')
        .select('id, access_token, scopes')
        .eq('user_id', user_id)
        .not('ads_customer_id', 'is', null);

      let revokedCount = 0;
      for (const conn of (conns || [])) {
        // 2. Revoke the access_token at Google (best effort — invalidates ALL scopes
        //    on this token; user will need to re-authorize remaining modules).
        //    NOTE: Google does not support per-scope revocation.
        if (conn.access_token) {
          try {
            const r = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.access_token)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            if (r.ok) revokedCount++;
          } catch (_) { /* best effort */ }
        }

        // 3. Clear Ads fields + remove adwords scope from scopes[]
        const newScopes = (conn.scopes || []).filter(
          (s: string) => s !== 'https://www.googleapis.com/auth/adwords'
        );
        await supabase
          .from('google_connections')
          .update({
            ads_customer_id: null,
            ads_account_name: null,
            ads_status: null,
            scopes: newScopes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id);
      }

      return jsonOk({ success: true, token_revoked: revokedCount > 0, cleared: (conns || []).length });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: unknown) {
    console.error('Google Ads connector error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonError(msg, 500);
  }
}));
