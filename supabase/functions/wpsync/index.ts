import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = 'https://crawlers.fr';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function getSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ─── POST: Generate magic link (called from SaaS frontend) ───
    if (req.method === 'POST') {
      // Restrict origin to crawlers.fr
      const origin = req.headers.get('origin') || '';
      if (!origin.includes('crawlers.fr') && !origin.includes('crawlers.lovable.app')) {
        return new Response(
          JSON.stringify({ error: 'Forbidden origin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Authenticate user via JWT
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = getSupabase();
      if (!supabase) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user via anon client
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const anonClient = createClient(Deno.env.get('SUPABASE_URL') || '', anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = claimsData.claims.sub;

      // Create magic link token (service role bypasses RLS)
      const { data: magicLink, error: mlError } = await supabase
        .from('magic_links')
        .insert({ user_id: userId })
        .select('token, expires_at')
        .single();

      if (mlError || !magicLink) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate magic link' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'magic_link',
          token: magicLink.token,
          expires_at: magicLink.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── GET: Standard config retrieval OR magic link redemption ───
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tempToken = url.searchParams.get('temp_token');

    // ─── Magic link redemption flow ───
    if (tempToken) {
      if (typeof tempToken !== 'string' || tempToken.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Invalid temp_token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Look up the token
      const { data: link, error: linkError } = await supabase
        .from('magic_links')
        .select('id, user_id, used, expires_at')
        .eq('token', tempToken)
        .maybeSingle();

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token', type: 'auth' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiry
      if (new Date(link.expires_at) < new Date()) {
        // Clean up expired token
        await supabase.from('magic_links').delete().eq('id', link.id);
        return new Response(
          JSON.stringify({ error: 'Token expired', type: 'auth' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already used
      if (link.used) {
        return new Response(
          JSON.stringify({ error: 'Token already used', type: 'auth' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as used
      await supabase
        .from('magic_links')
        .update({ used: true })
        .eq('id', link.id);

      // Fetch the user's permanent API key
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('api_key, credits_balance, email')
        .eq('user_id', link.user_id)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'User profile not found', type: 'auth' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'auth',
          api_key: profile.api_key,
          email: profile.email,
          credits_remaining: profile.credits_balance,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ─── Standard config retrieval (existing flow) ───
    const apiKey = url.searchParams.get('api_key');
    const domain = url.searchParams.get('domain');

    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid api_key parameter' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!domain || typeof domain !== 'string' || domain.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid domain parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '').toLowerCase();

    // Verify API key
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, credits_balance')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key', authenticated: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.credits_balance <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits. Please recharge your account.',
          authenticated: true,
          credits: 0 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch corrective code
    const { data: latestCode } = await supabase
      .from('saved_corrective_codes')
      .select('code, fixes_applied, created_at')
      .eq('user_id', profile.user_id)
      .ilike('url', `%${cleanDomain}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch audit data
    const { data: latestAudit } = await supabase
      .from('audits')
      .select('audit_data, created_at')
      .eq('user_id', profile.user_id)
      .eq('domain', cleanDomain)
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

    return new Response(
      JSON.stringify({
        success: true,
        type: 'config',
        domain: cleanDomain,
        credits_remaining: profile.credits_balance,
        last_audit: latestAudit?.created_at || null,
        robots_rules: robotsRules,
        json_ld: jsonLd,
        meta_tags: metaTags,
        corrective_script: latestCode?.code || null,
        fixes_applied: latestCode?.fixes_applied || [],
        generated_at: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ wp-sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
