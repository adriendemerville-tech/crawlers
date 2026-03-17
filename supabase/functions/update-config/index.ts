import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse body
    const body = await req.json();
    const { domain, json_ld, meta_tags, robots_rules, corrective_script } = body;

    if (!domain || typeof domain !== 'string' || domain.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '').toLowerCase();
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, credits_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the latest audit with the new config data
    const { data: latestAudit, error: auditFetchError } = await supabase
      .from('audits')
      .select('id, audit_data')
      .eq('user_id', userId)
      .eq('domain', cleanDomain)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditFetchError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching audit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build updated audit_data
    const existingAuditData = (latestAudit?.audit_data as Record<string, unknown>) || {};
    const updatedAuditData = {
      ...existingAuditData,
      ...(json_ld !== undefined && { json_ld }),
      ...(meta_tags !== undefined && { meta_tags }),
      ...(robots_rules !== undefined && { robots_rules }),
      wp_sync_updated_at: new Date().toISOString(),
    };

    if (latestAudit) {
      const { error: updateError } = await supabase
        .from('audits')
        .update({ 
          audit_data: updatedAuditData,
          ...(corrective_script ? { generated_code: corrective_script } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', latestAudit.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Error updating audit' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('audits')
        .insert({
          user_id: userId,
          domain: cleanDomain,
          url: `https://${cleanDomain}`,
          audit_data: updatedAuditData,
          ...(corrective_script ? { generated_code: corrective_script } : {}),
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Error creating audit record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Also persist current_config to tracked_sites for the matching domain
    const configPayload = {
      ...(json_ld !== undefined && { json_ld }),
      ...(meta_tags !== undefined && { meta_tags }),
      ...(robots_rules !== undefined && { robots_rules }),
      ...(corrective_script ? { corrective_script } : {}),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('tracked_sites')
      .update({ current_config: configPayload })
      .eq('user_id', userId)
      .eq('domain', cleanDomain);

    return new Response(
      JSON.stringify({
        success: true,
        domain: cleanDomain,
        message: 'Configuration updated. WordPress plugin will sync automatically.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ update-config error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
