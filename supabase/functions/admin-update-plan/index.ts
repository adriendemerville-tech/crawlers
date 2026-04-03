import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("No auth", 401);
    }

    const supabase = getUserClient(authHeader);
    const adminClient = getServiceClient();

    // Verify caller is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return jsonError("Admin only", 403);
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return jsonError("target_user_id required", 400);
    }

    // Strip Pro Agency: reset plan to free, clear subscription fields
    const { error } = await adminClient
      .from("profiles")
      .update({
        plan_type: "free",
        subscription_status: null,
        stripe_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq("user_id", target_user_id);

    if (error) throw error;

    return jsonOk({ success: true });
  } catch (err) {
    console.error(err);
    return jsonError(String(err), 500);
  }
}));