import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
Deno.serve(handleRequest(async (req) => {
try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabase = getServiceClient();

    // Verify calling user
    const anonClient = getUserClient(authHeader);
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { archive_id } = await req.json();
    if (!archive_id) throw new Error("Missing archive_id");

    // Fetch archive
    const { data: archive, error: fetchErr } = await supabase
      .from("archived_users")
      .select("*")
      .eq("id", archive_id)
      .single();

    if (fetchErr || !archive) throw new Error("Archive not found");

    // Verify email matches
    if (archive.email !== user.email) throw new Error("Email mismatch");

    const snapshot = (archive.profile_snapshot || {}) as Record<string, any>;

    // Restore credits and plan to current profile
    const updatePayload: Record<string, any> = {};
    if (archive.credits_balance && archive.credits_balance > 0) {
      updatePayload.credits_balance = archive.credits_balance;
    }
    if (archive.plan_type && archive.plan_type !== "free") {
      updatePayload.plan_type = archive.plan_type;
    }

    // Restore agency branding fields from snapshot
    const brandFields = [
      "agency_logo_url", "agency_primary_color", "agency_brand_name",
      "agency_contact_first_name", "agency_contact_last_name",
      "agency_contact_phone", "agency_contact_email",
      "agency_report_header_text", "agency_report_footer_text",
    ];
    for (const f of brandFields) {
      if (snapshot[f]) updatePayload[f] = snapshot[f];
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", user.id);
      if (updateErr) console.error("Profile update error:", updateErr);
    }

    // Record credit restoration transaction if applicable
    if (updatePayload.credits_balance) {
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: updatePayload.credits_balance,
        transaction_type: "restore",
        description: `Restauration depuis archive (${archive.original_user_id})`,
      });
    }

    // Delete archive entry after successful restore
    await supabase.from("archived_users").delete().eq("id", archive_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));