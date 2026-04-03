import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const { audit_id } = await req.json();

    if (!audit_id) {
      return jsonError("audit_id is required", 400);
    }

    console.log(`📝 Fetching script for audit: ${audit_id}`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = getServiceClient();

    // Fetch the audit record
    const { data: audit, error: fetchError } = await supabase
      .from("audits")
      .select("id, payment_status, generated_code, fixes_metadata, url, domain")
      .eq("id", audit_id)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Error fetching audit:", fetchError);
      return jsonError("Database error", 500);
    }

    if (!audit) {
      console.log(`❌ Audit not found: ${audit_id}`);
      return jsonError("Audit not found", 404);
    }

    // 🔐 SECURITY CHECK: Verify payment status
    if (audit.payment_status !== "paid") {
      console.log(`🔒 Access denied for audit ${audit_id}: payment_status = ${audit.payment_status}`);
      return jsonError("Payment required",
          message: "Le paiement est requis pour accéder au script complet.",
          payment_status: audit.payment_status, 402);
    }

    // ✅ Payment verified - return the full script
    console.log(`✅ Access granted for audit ${audit_id}`);

    return jsonOk({
        success: true,
        data: {
          audit_id: audit.id,
          url: audit.url,
          domain: audit.domain,
          code: audit.generated_code,
          fixes_metadata: audit.fixes_metadata,
        }
      });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ get-final-script error:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));