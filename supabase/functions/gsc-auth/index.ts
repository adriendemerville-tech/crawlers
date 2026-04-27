import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: gsc-auth
 * 
 * Handles Google Search Console OAuth2 flow:
 * - POST action=login  → Returns OAuth2 authorization URL (redirect_uri = this function)
 * - GET  (from Google) → Server-side callback: exchanges code, stores tokens, redirects to frontend
 * - POST action=fetch  → Uses stored tokens to fetch GSC data (30 days)
 */
Deno.serve(handleRequest(async (req) => {
const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

  // The canonical redirect URI registered in Google Cloud Console
  const REDIRECT_URI = `${supabaseUrl}/functions/v1/gsc-auth`;

  if (!clientId || !clientSecret) {
    return jsonError('Google GSC credentials not configured', 500);
  }

  const supabase = getServiceClient();

  // ═══════════════════════════════════════════════════════════════════
  // GET: Server-side OAuth callback from Google
  // Google redirects here with ?code=...&state=user_id|frontend_origin
  // ═══════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';
    const error = url.searchParams.get('error');

    // state format: "user_id|frontend_origin"
    const [userId, frontendOrigin] = state.split('|');
    const redirectBase = frontendOrigin || 'https://crawlers.fr';

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gsc_error=${encodeURIComponent(error)}` },
      });
    }

    if (!code || !userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gsc_error=missing_code` },
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
        console.error('Token exchange failed:', errText);
        return new Response(null, {
          status: 302,
          headers: { Location: `${redirectBase}/console?gsc_error=token_exchange_failed` },
        });
      }

      const tokens = await tokenResp.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Fetch the Google email for this connection
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

      // Fetch GSC site list for this connection
      let gscSiteUrls: string[] = [];
      try {
        const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (sitesResp.ok) {
          const { siteEntry = [] } = await sitesResp.json();
          gscSiteUrls = siteEntry.map((s: any) => s.siteUrl);
        }
      } catch (_) { /* best effort */ }

      // Auto-detect GA4 properties accessible with this token
      let ga4PropertyId: string | null = null;
      try {
        const ga4Resp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (ga4Resp.ok) {
          const ga4Data = await ga4Resp.json();
          const summaries = ga4Data.accountSummaries || [];
          for (const account of summaries) {
            const props = account.propertySummaries || [];
            if (props.length > 0) {
              ga4PropertyId = props[0].property || null;
              console.log(`[gsc-auth] Auto-detected GA4 property: ${ga4PropertyId} for ${googleEmail}`);
              break;
            }
          }
          if (!ga4PropertyId) {
            console.log(`[gsc-auth] GA4 Admin API OK but no properties found for ${googleEmail} (${summaries.length} accounts)`);
          }
        } else {
          const errBody = await ga4Resp.text().catch(() => '');
          console.log(`[gsc-auth] GA4 Admin API returned ${ga4Resp.status} for ${googleEmail}: ${errBody.slice(0, 200)}`);
        }
      } catch (e) {
        console.log('[gsc-auth] GA4 auto-detect failed (best effort):', e);
      }

      // Auto-detect GMB (Google Business Profile) accounts
      let gmbAccountId: string | null = null;
      let gmbLocationId: string | null = null;
      try {
        const gmbResp = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (gmbResp.ok) {
          const gmbData = await gmbResp.json();
          const accounts = gmbData.accounts || [];
          if (accounts.length > 0) {
            // accounts[0].name = "accounts/123456"
            gmbAccountId = accounts[0].name || null;
            console.log(`[gsc-auth] Auto-detected GMB account: ${gmbAccountId} for ${googleEmail}`);

            // Try to get the first location
            try {
              const locResp = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/${gmbAccountId}/locations?readMask=name,title,storefrontAddress`,
                { headers: { Authorization: `Bearer ${tokens.access_token}` } }
              );
              if (locResp.ok) {
                const locData = await locResp.json();
                const locations = locData.locations || [];
                if (locations.length > 0) {
                  gmbLocationId = locations[0].name || null;
                  console.log(`[gsc-auth] Auto-detected GMB location: ${gmbLocationId} for ${googleEmail}`);
                }
              } else {
                console.log(`[gsc-auth] GMB locations API returned ${locResp.status}`);
              }
            } catch (e) {
              console.log('[gsc-auth] GMB location detection failed:', e);
            }
          } else {
            console.log(`[gsc-auth] GMB accounts API OK but no accounts found for ${googleEmail}`);
          }
        } else {
          const errBody = await gmbResp.text().catch(() => '');
          console.log(`[gsc-auth] GMB accounts API returned ${gmbResp.status} for ${googleEmail}: ${errBody.slice(0, 200)}`);
        }
      } catch (e) {
        console.log('[gsc-auth] GMB auto-detect failed (best effort):', e);
      }

      // Auto-detect Google Ads accessible accounts (only if adwords scope was granted)
      let adsCustomerId: string | null = null;
      let adsAccountName: string | null = null;
      let adsStatus: string | null = null;
      try {
        const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
        if (developerToken) {
          const adsResp = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'developer-token': developerToken,
            },
          });
          if (adsResp.ok) {
            const adsData = await adsResp.json();
            const resourceNames: string[] = adsData.resourceNames || [];
            if (resourceNames.length > 0) {
              adsCustomerId = resourceNames[0].replace('customers/', '');
              adsAccountName = googleEmail;
              adsStatus = 'active';
              console.log(`[gsc-auth] Auto-detected Google Ads customer: ${adsCustomerId} for ${googleEmail}`);
            } else {
              console.log(`[gsc-auth] Ads listAccessibleCustomers OK but no customers for ${googleEmail}`);
            }
          } else {
            const errBody = await adsResp.text().catch(() => '');
            // 401/403 means scope not granted — silently skip (expected for users who didn't request Ads scope)
            if (adsResp.status !== 401 && adsResp.status !== 403) {
              console.log(`[gsc-auth] Google Ads API returned ${adsResp.status}: ${errBody.slice(0, 200)}`);
            }
          }
        }
      } catch (e) {
        console.log('[gsc-auth] Google Ads auto-detect failed (best effort):', e);
      }

      // Determine which scopes were actually granted by reading token info
      const grantedScopes: string[] = [];
      try {
        const tokenInfoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(tokens.access_token)}`);
        if (tokenInfoResp.ok) {
          const tokenInfo = await tokenInfoResp.json();
          if (tokenInfo.scope) {
            grantedScopes.push(...tokenInfo.scope.split(' '));
          }
          console.log(`[gsc-auth] Granted scopes for ${googleEmail}: ${grantedScopes.join(', ')}`);
        }
      } catch (_) { /* best effort */ }

      // Upsert into google_connections (multi-account support, unified OAuth)
      await supabase.from('google_connections').upsert({
        user_id: userId,
        google_email: googleEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry: expiresAt,
        gsc_site_urls: gscSiteUrls,
        ga4_property_id: ga4PropertyId,
        gmb_account_id: gmbAccountId,
        gmb_location_id: gmbLocationId,
        ads_customer_id: adsCustomerId,
        ads_account_name: adsAccountName,
        ads_status: adsStatus,
        scopes: grantedScopes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_email' });

      // Also update profiles for backward compatibility
      await supabase.from('profiles').update({
        gsc_access_token: tokens.access_token,
        gsc_refresh_token: tokens.refresh_token || null,
        gsc_token_expiry: expiresAt,
        ga4_property_id: ga4PropertyId,
      }).eq('user_id', userId);

      // Auto-link tracked sites to this connection
      const { data: conn } = await supabase
        .from('google_connections')
        .select('id')
        .eq('user_id', userId)
        .eq('google_email', googleEmail)
        .single();

      if (conn) {
        for (const siteUrl of gscSiteUrls) {
          const bare = siteUrl
            .replace(/^sc-domain:/, '')
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/+$/, '')
            .toLowerCase();
          // Link any tracked_sites matching this domain
          await supabase
            .from('tracked_sites')
            .update({ google_connection_id: conn.id })
            .eq('user_id', userId)
            .eq('domain', bare);
          // Also try with www prefix
          await supabase
            .from('tracked_sites')
            .update({ google_connection_id: conn.id })
            .eq('user_id', userId)
            .eq('domain', `www.${bare}`);
        }
      }

      // ═══ First GA4 pull — triggered immediately after OAuth ═══
      if (ga4PropertyId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          // Find all tracked sites for this user to pull GA4 data for each domain
          const { data: userSites } = await supabase
            .from('tracked_sites')
            .select('id, domain')
            .eq('user_id', userId);

          for (const site of (userSites || [])) {
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            // Fire-and-forget: don't block the redirect
            fetch(`${supabaseUrl}/functions/v1/fetch-ga4-data`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'fetch_metrics',
                user_id: userId,
                property_id: ga4PropertyId,
                domain: site.domain,
                start_date: startDate,
                end_date: endDate,
              }),
            }).then(r => console.log(`[gsc-auth] GA4 first pull for ${site.domain}: ${r.status}`))
              .catch(e => console.error(`[gsc-auth] GA4 first pull failed for ${site.domain}:`, e));
          }
          console.log(`[gsc-auth] 🚀 GA4 first pull triggered for ${(userSites || []).length} site(s)`);
        } catch (e) {
          console.error('[gsc-auth] GA4 first pull error (non-blocking):', e);
        }
      }

      // Redirect back to frontend with success
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gsc_connected=true&google_email=${encodeURIComponent(googleEmail)}` },
      });

    } catch (e) {
      console.error('GSC callback error:', e);
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectBase}/console?gsc_error=internal` },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // POST: API calls (login, fetch)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const { action, site_url, user_id: body_user_id, frontend_origin, start_date, end_date, connection_id, google_email, modules, extra_scopes } = await req.json();

    // ─── SECURITY: Validate JWT and enforce real user_id ─────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceRole = serviceRoleKey && token === serviceRoleKey;

    let user_id: string;
    if (isServiceRole) {
      // Internal calls can specify user_id
      if (!body_user_id) return jsonError('user_id required for service calls', 400);
      user_id = body_user_id;
    } else if (action === 'login') {
      // Login doesn't require auth yet — user_id comes from frontend state
      user_id = body_user_id || '';
    } else {
      // All other actions: extract from JWT, ignore body user_id
      const { getUserClient } = await import('../_shared/supabaseClient.ts');
      const userClient = getUserClient(authHeader);
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return jsonError('Unauthorized', 401);
      user_id = user.id;
    }

    // Check if full Google access is enabled via system_config
    const supabase = getServiceClient();
    let fullGoogleAccess = false;
    const { data: accessConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'ga4_oauth_enabled')
      .maybeSingle();
    if (accessConfig?.value && typeof accessConfig.value === 'object' && (accessConfig.value as any).active === true) {
      fullGoogleAccess = true;
    }

    // === LOGIN: Generate OAuth URL (UNIFIED — accepts modules[] or extra_scopes[]) ===
    if (action === 'login') {
      // state format: "user_id|frontend_origin" — backward compatible
      const stateValue = `${user_id || ''}|${frontend_origin || ''}`;

      // Map module aliases → Google scopes (frontend can request "ads", "gmb", "ga4", "gsc", "gtm", "indexing")
      const MODULE_SCOPES: Record<string, string[]> = {
        gsc: ['https://www.googleapis.com/auth/webmasters.readonly'],
        ga4: ['https://www.googleapis.com/auth/analytics.readonly'],
        gmb: ['https://www.googleapis.com/auth/business.manage'],
        ads: ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'],
        gtm: [
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.publish',
        ],
        indexing: ['https://www.googleapis.com/auth/indexing'],
      };

      // Always include GSC (legacy default for this endpoint)
      const scopeSet = new Set<string>(['https://www.googleapis.com/auth/webmasters.readonly']);

      // Mode 1: explicit modules[] from frontend (e.g. ["gsc","ga4","ads"])
      if (Array.isArray(modules) && modules.length > 0) {
        for (const m of modules) {
          const s = MODULE_SCOPES[String(m).toLowerCase()];
          if (s) s.forEach(v => scopeSet.add(v));
        }
      } else if (fullGoogleAccess) {
        // Mode 2: legacy "full access" flag — request everything except Ads (still gated)
        ['ga4', 'gtm', 'gmb', 'indexing'].forEach(k => MODULE_SCOPES[k].forEach(v => scopeSet.add(v)));
      }

      // Mode 3: explicit extra_scopes[] (escape hatch)
      if (Array.isArray(extra_scopes)) {
        for (const s of extra_scopes) if (typeof s === 'string') scopeSet.add(s);
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: Array.from(scopeSet).join(' '),
        access_type: 'offline',
        prompt: 'consent', // forces refresh_token + re-consent on incremental scopes
        state: stateValue,
        include_granted_scopes: 'true', // incremental authorization (Google merges with previously granted scopes)
      });

      return new Response(JSON.stringify({
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        scopes_requested: Array.from(scopeSet),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === STATUS: Check connection status for a user ===
    if (action === 'status') {
      if (!user_id) {
        return jsonError('user_id required', 400);
      }

      // Get all google_connections for this user
      const { data: connections } = await supabase
        .from('google_connections')
        .select('id, google_email, gsc_site_urls, ga4_property_id, token_expiry, updated_at')
        .eq('user_id', user_id);

      // Also check legacy profile tokens
      const { data: profile } = await supabase
        .from('profiles')
        .select('gsc_access_token, gsc_token_expiry, ga4_property_id')
        .eq('user_id', user_id)
        .single();

      const hasLegacy = !!profile?.gsc_access_token;
      const legacyExpired = hasLegacy && profile.gsc_token_expiry
        ? new Date(profile.gsc_token_expiry) < new Date()
        : false;

      return new Response(JSON.stringify({
        connected: (connections && connections.length > 0) || hasLegacy,
        connections: (connections || []).map(c => ({
          id: c.id,
          google_email: c.google_email,
          gsc_site_urls: c.gsc_site_urls,
          ga4_property_id: c.ga4_property_id,
          token_expired: c.token_expiry ? new Date(c.token_expiry) < new Date() : false,
          updated_at: c.updated_at,
        })),
        legacy: hasLegacy ? {
          expired: legacyExpired,
          ga4_property_id: profile.ga4_property_id,
        } : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DISCONNECT: Revoke Google token and remove connection ===
    if (action === 'disconnect') {
      if (!user_id) {
        return jsonError('user_id required', 400);
      }

      const targetConnectionId = connection_id;
      const targetEmail = google_email;

      let revokedCount = 0;
      let deletedCount = 0;

      // If a specific connection_id is provided, disconnect only that one
      if (targetConnectionId) {
        const { data: conn } = await supabase
          .from('google_connections')
          .select('access_token, refresh_token')
          .eq('id', targetConnectionId)
          .eq('user_id', user_id)
          .single();

        if (conn) {
          // Revoke token at Google
          const tokenToRevoke = conn.access_token || conn.refresh_token;
          if (tokenToRevoke) {
            const revokeResp = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            if (revokeResp.ok) revokedCount++;
            else console.warn(`[gsc-auth] Token revocation returned ${revokeResp.status}`);
          }

          // Unlink tracked_sites referencing this connection
          await supabase
            .from('tracked_sites')
            .update({ google_connection_id: null })
            .eq('google_connection_id', targetConnectionId);

          // Delete the connection row
          await supabase
            .from('google_connections')
            .delete()
            .eq('id', targetConnectionId)
            .eq('user_id', user_id);
          deletedCount++;
        }
      } else {
        // Disconnect ALL connections for this user (or filter by email)
        let query = supabase
          .from('google_connections')
          .select('id, access_token, refresh_token')
          .eq('user_id', user_id);
        if (targetEmail) query = query.eq('google_email', targetEmail);

        const { data: allConns } = await query;

        for (const conn of (allConns || [])) {
          const tokenToRevoke = conn.access_token || conn.refresh_token;
          if (tokenToRevoke) {
            const revokeResp = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            if (revokeResp.ok) revokedCount++;
          }

          await supabase
            .from('tracked_sites')
            .update({ google_connection_id: null })
            .eq('google_connection_id', conn.id);

          await supabase
            .from('google_connections')
            .delete()
            .eq('id', conn.id);
          deletedCount++;
        }
      }

      // Also clear legacy profile tokens
      await supabase.from('profiles').update({
        gsc_access_token: null,
        gsc_refresh_token: null,
        gsc_token_expiry: null,
      }).eq('user_id', user_id);

      return jsonOk({
        success: true,
        revoked_tokens: revokedCount,
        deleted_connections: deletedCount,
      });
    }

    // === FORCE_REFRESH: Admin tool to refresh token + re-detect GA4/GMB ===
    if (action === 'force_refresh') {
      if (!user_id || !connection_id) {
        return jsonError('user_id and connection_id required', 400);
      }

      const { data: conn } = await supabase
        .from('google_connections')
        .select('*')
        .eq('id', connection_id)
        .eq('user_id', user_id)
        .single();

      if (!conn) return jsonError('Connection not found', 404);
      if (!conn.refresh_token) return jsonError('No refresh token available', 400);

      // Refresh the token
      const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: conn.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResp.ok) {
        const errText = await refreshResp.text();
        return jsonError(`Token refresh failed (${refreshResp.status}): ${errText.slice(0, 300)}`, 400);
      }

      const tokens = await refreshResp.json();
      const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
      const freshToken = tokens.access_token;

      // Get scopes from tokeninfo
      let grantedScopes: string[] = [];
      try {
        const tiResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(freshToken)}`);
        if (tiResp.ok) {
          const ti = await tiResp.json();
          if (ti.scope) grantedScopes = ti.scope.split(' ');
        }
      } catch (_) {}

      // Detect GSC sites
      let gscSiteUrls: string[] = [];
      try {
        const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (r.ok) {
          const d = await r.json();
          gscSiteUrls = (d.siteEntry || []).map((s: any) => s.siteUrl);
        } else {
          console.log(`[force_refresh] GSC sites: ${r.status}`);
        }
      } catch (_) {}

      // Detect GA4
      let ga4PropertyId: string | null = null;
      try {
        const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (r.ok) {
          const d = await r.json();
          for (const acct of (d.accountSummaries || [])) {
            const props = acct.propertySummaries || [];
            if (props.length > 0) { ga4PropertyId = props[0].property; break; }
          }
        } else {
          console.log(`[force_refresh] GA4: ${r.status} ${(await r.text()).slice(0, 200)}`);
        }
      } catch (_) {}

      // Detect GMB
      let gmbAccountId: string | null = null;
      let gmbLocationId: string | null = null;
      try {
        const r = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (r.ok) {
          const d = await r.json();
          if ((d.accounts || []).length > 0) {
            gmbAccountId = d.accounts[0].name;
            try {
              const lr = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/${gmbAccountId}/locations?readMask=name,title,storefrontAddress`,
                { headers: { Authorization: `Bearer ${freshToken}` } }
              );
              if (lr.ok) {
                const ld = await lr.json();
                if ((ld.locations || []).length > 0) gmbLocationId = ld.locations[0].name;
              } else {
                console.log(`[force_refresh] GMB locations: ${lr.status}`);
              }
            } catch (_) {}
          }
        } else {
          console.log(`[force_refresh] GMB: ${r.status} ${(await r.text()).slice(0, 200)}`);
        }
      } catch (_) {}

      // Update the connection
      await supabase.from('google_connections').update({
        access_token: freshToken,
        token_expiry: newExpiry,
        scopes: grantedScopes,
        gsc_site_urls: gscSiteUrls.length > 0 ? gscSiteUrls : conn.gsc_site_urls,
        ga4_property_id: ga4PropertyId || conn.ga4_property_id,
        gmb_account_id: gmbAccountId || conn.gmb_account_id,
        gmb_location_id: gmbLocationId || conn.gmb_location_id,
        updated_at: new Date().toISOString(),
      }).eq('id', connection_id);

      return jsonOk({
        success: true,
        scopes: grantedScopes,
        gsc_site_urls: gscSiteUrls,
        ga4_property_id: ga4PropertyId,
        gmb_account_id: gmbAccountId,
        gmb_location_id: gmbLocationId,
        token_expiry: newExpiry,
      });
    }

    // === FETCH: Get GSC data for last 30 days ===
    if (action === 'fetch') {
      if (!user_id) {
        return jsonError('user_id required', 400);
      }

      // Resolve the correct Google token for this domain (multi-account aware)
      const requestedSite = site_url || '';
      const bareDomain = requestedSite
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '')
        .toLowerCase();

      if (!bareDomain) {
        return jsonError('No site URL configured', 400);
      }

      const resolved = await resolveGoogleToken(supabase, user_id, bareDomain, clientId, clientSecret);

      if (!resolved) {
        return jsonError('GSC not connected', 401);
      }

      const accessToken = resolved.access_token;
      console.log(`[gsc-auth] Token resolved via ${resolved.source} for "${bareDomain}" (connection: ${resolved.connection_id})`);

      // List all GSC properties to find the matching one
      const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      let resolvedSiteUrl = requestedSite;
      if (sitesResp.ok) {
        const sitesData = await sitesResp.json();
        const allSites: { siteUrl: string; permissionLevel: string }[] = sitesData.siteEntry || [];

        const match = allSites.find(s => {
          const su = s.siteUrl.toLowerCase();
          if (su === `sc-domain:${bareDomain}`) return true;
          const cleaned = su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
          return cleaned === bareDomain;
        });

        if (match) {
          resolvedSiteUrl = match.siteUrl;
          console.log(`[gsc-auth] Resolved "${requestedSite}" → "${resolvedSiteUrl}"`);
        } else {
          console.log(`[gsc-auth] No matching property found for "${bareDomain}". Available: ${allSites.map(s => s.siteUrl).join(', ')}`);
          return jsonError(`Site not found in Search Console. Available: ${allSites.map(s => s.siteUrl).join(', ')}`, 404);
        }
      } else {
        await sitesResp.text();
      }

      const endDate = end_date ? new Date(end_date) : new Date();
      const startDate = start_date ? new Date(start_date) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const gscResp = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resolvedSiteUrl)}/searchAnalytics/query`,
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

      // Compute totals (position weighted by impressions for accuracy)
      let totalClicks = 0, totalImpressions = 0, weightedPositionSum = 0;
      const rows = gscData.rows || [];
      for (const row of rows) {
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const position = row.position || 0;
        totalClicks += clicks;
        totalImpressions += impressions;
        weightedPositionSum += position * impressions;
      }

      return new Response(JSON.stringify({
        rows,
        total_clicks: totalClicks,
        total_impressions: totalImpressions,
        avg_position: totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0,
        date_range: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return jsonError('Invalid action', 400);

  } catch (error: unknown) {
    console.error('gsc-auth error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return jsonError(msg, 500);
  }
}));