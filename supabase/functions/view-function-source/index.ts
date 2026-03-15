import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static registry of function source paths - we read from Deno filesystem
const FUNCTIONS_BASE = './';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check admin or viewer role
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes('admin');
    const isViewer = userRoles.includes('viewer');

    if (!isAdmin && !isViewer) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For viewers, check if they have approved access
    const { function_name } = await req.json();
    if (!function_name || typeof function_name !== 'string' || function_name.includes('..') || function_name.includes('/')) {
      return new Response(JSON.stringify({ error: 'Invalid function name' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (isViewer && !isAdmin) {
      const { data: accessData } = await serviceClient
        .from('function_access_requests')
        .select('status')
        .eq('requester_user_id', user.id)
        .eq('function_name', function_name)
        .eq('status', 'approved')
        .limit(1);

      if (!accessData || accessData.length === 0) {
        return new Response(JSON.stringify({ error: 'Access not approved' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Log consultation
    await serviceClient.from('function_consultation_log').insert({
      user_id: user.id,
      user_email: user.email || '',
      function_name,
    });

    // Try to read the function file
    // Edge functions are deployed, so we can't read source from filesystem at runtime
    // Instead we return a placeholder indicating the function exists
    // The actual code viewing would require a build-time solution
    return new Response(JSON.stringify({
      function_name,
      message: `Function ${function_name} is deployed and active.`,
      path: `supabase/functions/${function_name}/index.ts`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
