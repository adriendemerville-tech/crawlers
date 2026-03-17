import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audit_id } = await req.json();

    if (!audit_id) {
      return new Response(
        JSON.stringify({ error: "audit_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!audit) {
      console.log(`❌ Audit not found: ${audit_id}`);
      return new Response(
        JSON.stringify({ error: "Audit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔐 SECURITY CHECK: Verify payment status
    if (audit.payment_status !== "paid") {
      console.log(`🔒 Access denied for audit ${audit_id}: payment_status = ${audit.payment_status}`);
      return new Response(
        JSON.stringify({ 
          error: "Payment required",
          message: "Le paiement est requis pour accéder au script complet.",
          payment_status: audit.payment_status
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Payment verified - return the full script
    console.log(`✅ Access granted for audit ${audit_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          audit_id: audit.id,
          url: audit.url,
          domain: audit.domain,
          code: audit.generated_code,
          fixes_metadata: audit.fixes_metadata,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ get-final-script error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
