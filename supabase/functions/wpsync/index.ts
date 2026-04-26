import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

function getSupabase() {
  try {
    return getServiceClient();
  } catch {
    return null;
  }
}

Deno.serve(handleRequest(async (req) => {
try {
    const url = new URL(req.url);

    // ─── POST: Generate magic link (called from SaaS frontend) ───
    if (req.method === 'POST') {
      const origin = req.headers.get('origin') || '';
      const ALLOWED_ORIGINS = ['crawlers.fr', 'lovable.app', 'lovableproject.com', 'localhost'];
      if (!ALLOWED_ORIGINS.some((o) => origin.includes(o))) {
        console.warn('[wpsync] forbidden origin:', origin);
        return jsonError('Forbidden origin', 403);
      }

      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError('Unauthorized', 401);
      }

      const supabase = getSupabase();
      if (!supabase) {
        return jsonError('Server configuration error', 500);
      }

      const anonClient = getUserClient(authHeader);
      const { data: userData, error: userError } = await anonClient.auth.getUser();
      if (userError || !userData?.user?.id) {
        return jsonError('Invalid token', 401);
      }

      const userId = userData.user.id;

      // Parse optional body for site_id context
      let siteId: string | null = null;
      try {
        const body = await req.json();
        siteId = body?.site_id || null;
      } catch { /* no body or invalid json, that's ok */ }

      // Create magic link token
      const { data: magicLink, error: mlError } = await supabase
        .from('magic_links')
        .insert({ user_id: userId })
        .select('token, expires_at')
        .single();

      if (mlError || !magicLink) {
        return jsonError('Failed to generate magic link', 500);
      }

      // If site_id provided, return the site api_key too
      let siteApiKey: string | null = null;
      if (siteId) {
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('api_key')
          .eq('id', siteId)
          .eq('user_id', userId)
          .maybeSingle();
        siteApiKey = site?.api_key || null;
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'magic_link',
          token: magicLink.token,
          expires_at: magicLink.expires_at,
          ...(siteApiKey ? { site_api_key: siteApiKey } : {}),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET: Standard config retrieval OR magic link redemption ───
    if (req.method !== 'GET') {
      return jsonError('Method not allowed', 405);
    }

    const supabase = getSupabase();
    if (!supabase) {
      return jsonError('Server configuration error', 500);
    }

    const tempToken = url.searchParams.get('temp_token');

    // ─── Magic link redemption flow ───
    if (tempToken) {
      if (typeof tempToken !== 'string' || tempToken.length < 10) {
        return jsonError('Invalid temp_token', 400);
      }

      const { data: link, error: linkError } = await supabase
        .from('magic_links')
        .select('id, user_id, used, expires_at')
        .eq('token', tempToken)
        .maybeSingle();

      if (linkError || !link) {
        return jsonError('Invalid or expired token', type: 'auth', 401);
      }

      if (new Date(link.expires_at) < new Date()) {
        await supabase.from('magic_links').delete().eq('id', link.id);
        return jsonError('Token expired', type: 'auth', 401);
      }

      if (link.used) {
        return jsonError('Token already used', type: 'auth', 401);
      }

      await supabase
        .from('magic_links')
        .update({ used: true })
        .eq('id', link.id);

      // Return all user's tracked sites with their per-site api_keys
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('id, domain, site_name, api_key')
        .eq('user_id', link.user_id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance, email')
        .eq('user_id', link.user_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          type: 'auth',
          sites: (trackedSites || []).map(s => ({
            id: s.id,
            domain: s.domain,
            site_name: s.site_name,
            api_key: s.api_key,
          })),
          email: profile?.email || null,
          credits_remaining: profile?.credits_balance || 0,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ─── Standard config retrieval: now uses SITE-LEVEL api_key ───
    const apiKey = url.searchParams.get('api_key');
    const domain = url.searchParams.get('domain');

    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      return jsonError('Missing or invalid api_key parameter', 401);
    }

    // Try site-level api_key first (new model)
    const { data: site, error: siteError } = await supabase
      .from('tracked_sites')
      .select('id, user_id, domain, current_config, api_key')
      .eq('api_key', apiKey)
      .maybeSingle();

    // Fallback to profile-level api_key (legacy)
    let userId: string | null = null;
    let cleanDomain: string;
    let currentConfig: Record<string, unknown> | null = null;

    if (site) {
      userId = site.user_id;
      cleanDomain = site.domain;
      currentConfig = site.current_config as Record<string, unknown> | null;
    } else {
      // Legacy: check profile api_key
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, credits_balance')
        .eq('api_key', apiKey)
        .maybeSingle();

      if (profileError || !profile) {
        return jsonError('Invalid API key', authenticated: false, 401);
      }
      userId = profile.user_id;
      
      if (!domain || typeof domain !== 'string' || domain.length < 3) {
        return jsonError('Missing or invalid domain parameter', 400);
      }
      cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '').toLowerCase();
    }

    // Check credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('user_id', userId!)
      .maybeSingle();

    if (!profile || profile.credits_balance <= 0) {
      return jsonError('Insufficient credits. Please recharge your account.',
          authenticated: true,
          credits: 0, 403);
    }

    // If site has current_config, return it directly (new model)
    if (currentConfig && Object.keys(currentConfig).length > 0) {
      return jsonOk({
          success: true,
          type: 'config',
          domain: cleanDomain!,
          credits_remaining: profile.credits_balance,
          ...currentConfig,
          generated_at: new Date().toISOString(),
        });
    }

    // Fallback: build config from audits + saved_corrective_codes (legacy)
    const { data: latestCode } = await supabase
      .from('saved_corrective_codes')
      .select('code, fixes_applied, created_at')
      .eq('user_id', userId!)
      .ilike('url', `%${cleanDomain!}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestAudit } = await supabase
      .from('audits')
      .select('audit_data, created_at')
      .eq('user_id', userId!)
      .eq('domain', cleanDomain!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const auditData = latestAudit?.audit_data as Record<string, unknown> | null;

    let robotsRules: string | null = null;
    let jsonLd: unknown = null;
    let metaTags: Record<string, string> = {};

    if (auditData) {
      const recommendations = (auditData.recommendations || auditData.issues || []) as Array<Record<string, unknown>>;
      
      const robotsRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('robots') || String(r.title || '').toLowerCase().includes('robots')
      );
      if (robotsRec?.codeSnippet) robotsRules = String(robotsRec.codeSnippet);

      const jsonLdRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('schema') || String(r.id || '').includes('json_ld') || 
        String(r.title || '').toLowerCase().includes('json-ld') || String(r.title || '').toLowerCase().includes('schema')
      );
      if (jsonLdRec?.codeSnippet) {
        try { jsonLd = JSON.parse(String(jsonLdRec.codeSnippet)); } catch { jsonLd = String(jsonLdRec.codeSnippet); }
      }

      const metaRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('meta') || String(r.title || '').toLowerCase().includes('meta')
      );
      if (metaRec?.codeSnippet) metaTags = { raw: String(metaRec.codeSnippet) };

      if (auditData.robots_rules) robotsRules = String(auditData.robots_rules);
      if (auditData.json_ld) jsonLd = auditData.json_ld;
      if (auditData.meta_tags) metaTags = auditData.meta_tags as Record<string, string>;
    }

    return jsonOk({
        success: true,
        type: 'config',
        domain: cleanDomain!,
        credits_remaining: profile.credits_balance,
        last_audit: latestAudit?.created_at || null,
        robots_rules: robotsRules,
        json_ld: jsonLd,
        meta_tags: metaTags,
        corrective_script: latestCode?.code || null,
        fixes_applied: latestCode?.fixes_applied || [],
        generated_at: new Date().toISOString(),
      });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ wp-sync error:', error);
    return jsonError('Internal server error', details: errorMessage, 500);
  }
}));