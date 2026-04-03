import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = getUserClient(authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError('Unauthorized', 401);
    }

    const serviceClient = getServiceClient();
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isAdmin = userRoles.includes('admin');
    const isViewer = userRoles.includes('viewer');

    if (!isAdmin && !isViewer) {
      return jsonError('Forbidden', 403);
    }

    const { function_name } = await req.json();
    if (!function_name || typeof function_name !== 'string' || /[^a-z0-9\-]/.test(function_name)) {
      return jsonError('Invalid function name', 400);
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
        return jsonError('Access not approved', 403);
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

    return jsonOk({ function_name, code });
  } catch (err) {
    return jsonError(String(err), 500);
  }
}));