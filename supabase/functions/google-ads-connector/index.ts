import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUserId } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { resolveAdsCredentials } from '../_shared/keywordPlanner.ts';
import { getKeywordVolumes } from '../_shared/keywordVolumeSource.ts';

/**
 * Remplit `keyword_universe.search_volume` depuis Keyword Planner (gratuit),
 * en passant d'abord par le pool mutualisé `keyword_volume_pool`.
 * DataForSEO n'est appelé que si `allow_paid === true`.
 */
async function backfillKeywordUniverse(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  opts: { domain?: string; tracked_site_id?: string; limit?: number; geo?: string; language?: string; allow_paid?: boolean },
) {
  const limit = Math.min(opts.limit ?? 2000, 2000);

  let query = supabase
    .from('keyword_universe')
    .select('id, keyword, search_volume, difficulty, sources')
    .eq('user_id', userId)
    .is('search_volume', null)
    .limit(limit);

  if (opts.domain) query = query.eq('domain', opts.domain.replace(/^www\./, ''));
  if (opts.tracked_site_id) query = query.eq('tracked_site_id', opts.tracked_site_id);

  const { data: rows, error } = await query;
  if (error) return { error: error.message, updated: 0 };
  if (!rows?.length) return { updated: 0, candidates: 0, message: 'Aucun mot-clé sans volume' };

  const { volumes, stats } = await getKeywordVolumes(
    supabase,
    userId,
    rows.map((r: any) => r.keyword),
    { geo: opts.geo, language: opts.language, allowPaid: opts.allow_paid === true },
  );

  let updated = 0;
  for (const row of rows as any[]) {
    const rec = volumes.get((row.keyword || '').trim().toLowerCase());
    if (!rec) continue;
    const sources: string[] = Array.isArray(row.sources) ? row.sources : [];
    const tag = rec.source === 'pool' ? 'volume_pool' : rec.source;
    const { error: upErr } = await supabase
      .from('keyword_universe')
      .update({
        search_volume: rec.search_volume,
        difficulty: row.difficulty ?? rec.difficulty,
        sources: sources.includes(tag) ? sources : [...sources, tag],
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (!upErr) updated++;
  }

  console.log(`[keyword-volumes] user=${userId} candidats=${rows.length} maj=${updated} planner=${stats.from_planner} pool=${stats.from_pool} payant=${stats.from_dataforseo}`);
  return { updated, candidates: rows.length, stats };
}


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
    const body = await req.json().catch(() => ({}));
    const { action, frontend_origin } = body;

    // ─── CRON: backfill des volumes Keyword Planner pour tous les comptes Ads ───
    const headerSecret = req.headers.get('x-cron-secret');
    const isCron = !!headerSecret && [
      Deno.env.get('CRON_SECRET'), Deno.env.get('CRON_SECRET_V2'),
    ].filter(Boolean).includes(headerSecret);

    if (action === 'backfill_all_volumes') {
      if (!isCron) return jsonError('Cron secret required', 401);
      const { data: conns } = await supabase
        .from('google_connections')
        .select('user_id')
        .not('ads_customer_id', 'is', null);
      const userIds = [...new Set((conns || []).map((c: any) => c.user_id))];
      const results: any[] = [];
      for (const uid of userIds) {
        results.push({ user_id: uid, ...(await backfillKeywordUniverse(supabase, uid, body)) });
      }
      return jsonOk({ success: true, users: userIds.length, results });
    }

    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return jsonError('Authentication required', 401);
    }
    const user_id = authenticatedUserId;

    // ─── KEYWORD PLANNER: lookup brut mutualisé (pool → Planner → DataForSEO) ───
    if (action === 'keyword_volumes') {
      const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : [];
      if (keywords.length === 0) return jsonError('keywords[] required', 400);
      const { volumes, stats } = await getKeywordVolumes(supabase, user_id, keywords.slice(0, 2000), {
        geo: body.geo, language: body.language, allowPaid: body.allow_paid === true,
      });
      return jsonOk({ success: true, stats, metrics: Array.from(volumes.values()) });
    }

    // ─── KEYWORD PLANNER: remplit keyword_universe.search_volume ───
    if (action === 'backfill_volumes') {
      const res = await backfillKeywordUniverse(supabase, user_id, body);
      return jsonOk({ success: true, ...res });
    }

    // ─── KEYWORD PLANNER: état de la couverture volumes ───
    if (action === 'volumes_status') {
      const creds = await resolveAdsCredentials(supabase, user_id);
      const [{ count: total }, { count: missing }, { count: pooled }] = await Promise.all([
        supabase.from('keyword_universe').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
        supabase.from('keyword_universe').select('id', { count: 'exact', head: true }).eq('user_id', user_id).is('search_volume', null),
        supabase.from('keyword_volume_pool').select('id', { count: 'exact', head: true }),
      ]);
      return jsonOk({
        keyword_planner_available: !!creds,
        developer_token_configured: !!Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN'),
        keyword_universe_total: total ?? 0,
        keyword_universe_missing_volume: missing ?? 0,
        shared_pool_size: pooled ?? 0,
      });
    }


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
