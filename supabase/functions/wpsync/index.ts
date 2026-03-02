import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('api_key');
    const domain = url.searchParams.get('domain');

    // Validate required params
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

    // Sanitize domain
    const cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '').toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Step 1: Verify API key and get user
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

    // Step 2: Check that user has an active subscription (credits > 0 as proxy)
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

    // Step 3: Fetch the latest corrective code for this domain
    const { data: latestCode, error: codeError } = await supabase
      .from('saved_corrective_codes')
      .select('code, fixes_applied, created_at')
      .eq('user_id', profile.user_id)
      .ilike('url', `%${cleanDomain}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Step 4: Fetch the latest audit data for this domain
    const { data: latestAudit, error: auditError } = await supabase
      .from('audits')
      .select('audit_data, created_at')
      .eq('user_id', profile.user_id)
      .eq('domain', cleanDomain)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Step 5: Extract relevant fields from audit_data
    const auditData = latestAudit?.audit_data as Record<string, unknown> | null;

    // Extract robots_rules from audit recommendations
    let robotsRules: string | null = null;
    let jsonLd: unknown = null;
    let metaTags: Record<string, string> = {};

    if (auditData) {
      // Extract from audit_data structure
      const recommendations = (auditData.recommendations || auditData.issues || []) as Array<Record<string, unknown>>;
      
      // Look for robots-related recommendations
      const robotsRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('robots') || String(r.title || '').toLowerCase().includes('robots')
      );
      if (robotsRec?.codeSnippet) robotsRules = String(robotsRec.codeSnippet);

      // Look for JSON-LD recommendations  
      const jsonLdRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('schema') || String(r.id || '').includes('json_ld') || 
        String(r.title || '').toLowerCase().includes('json-ld') || String(r.title || '').toLowerCase().includes('schema')
      );
      if (jsonLdRec?.codeSnippet) {
        try {
          jsonLd = JSON.parse(String(jsonLdRec.codeSnippet));
        } catch {
          jsonLd = String(jsonLdRec.codeSnippet);
        }
      }

      // Look for meta tag recommendations
      const metaRec = recommendations.find((r: Record<string, unknown>) => 
        String(r.id || '').includes('meta') || String(r.title || '').toLowerCase().includes('meta')
      );
      if (metaRec?.codeSnippet) {
        metaTags = { raw: String(metaRec.codeSnippet) };
      }

      // Also extract top-level fields if they exist
      if (auditData.robots_rules) robotsRules = String(auditData.robots_rules);
      if (auditData.json_ld) jsonLd = auditData.json_ld;
      if (auditData.meta_tags) metaTags = auditData.meta_tags as Record<string, string>;
    }

    // Build response
    const response = {
      success: true,
      domain: cleanDomain,
      credits_remaining: profile.credits_balance,
      last_audit: latestAudit?.created_at || null,
      robots_rules: robotsRules,
      json_ld: jsonLd,
      meta_tags: metaTags,
      corrective_script: latestCode?.code || null,
      fixes_applied: latestCode?.fixes_applied || [],
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
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
