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

    // Only admin (creator) can execute this
    const serviceClient = getServiceClient();
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes('admin')) {
      return jsonError('Forbidden: admin only', 403);
    }

    // Delete all viewer, viewer_level2, and auditor roles
    const { data: deletedViewers, error: deleteError } = await serviceClient
      .from('user_roles')
      .delete()
      .in('role', ['viewer', 'viewer_level2', 'auditor'])
      .select('user_id, role');

    if (deleteError) {
      return jsonError(deleteError.message, 500);
    }

    // Also revoke all approved function access requests
    await serviceClient
      .from('function_access_requests')
      .update({ status: 'revoked', resolved_at: new Date().toISOString(), resolved_by: user.id })
      .in('status', ['approved', 'pending']);

    const removedCount = deletedViewers?.length || 0;

    return jsonOk({
      success: true,
      removed_count: removedCount,
      removed: deletedViewers || [],
    });
  } catch (err) {
    return jsonError(String(err), 500);
  }
}));