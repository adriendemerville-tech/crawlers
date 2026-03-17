import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getUserClient(authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    const { function_name } = await req.json();
    if (!function_name || typeof function_name !== 'string' || /[^a-z0-9\-]/.test(function_name)) {
      return new Response(JSON.stringify({ error: 'Invalid function name' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For viewers, check approved access
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

    // Try to read the function source from the deployed functions directory
    let code = '';
    try {
      // In Deno Deploy, sibling functions are at ../function_name/index.ts
      const filePath = new URL(`../${function_name}/index.ts`, import.meta.url);
      code = await Deno.readTextFile(filePath);
    } catch {
      try {
        // Alternative path
        const altPath = `/home/deno/functions/${function_name}/index.ts`;
        code = await Deno.readTextFile(altPath);
      } catch {
        code = `// Source code for ${function_name} is deployed but not readable from this context.\n// Path: supabase/functions/${function_name}/index.ts`;
      }
    }

    return new Response(JSON.stringify({ function_name, code }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
