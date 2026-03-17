import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report_id, referrer_id, visitor_ip } = await req.json();

    if (!report_id || !referrer_id || !visitor_ip) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();

    // 1. Check referrer exists
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("user_id, credits_balance")
      .eq("user_id", referrer_id)
      .single();

    if (!referrerProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Referrer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Self-click check: get visitor from auth header if available
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonClient = getUserClient(authHeader);
      const { data: { user } } = await anonClient.auth.getUser();
      if (user && user.id === referrer_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Self-click not rewarded" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Anti-fraud: check if this IP already clicked for this referrer today OR this specific report
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existingClicks } = await supabase
      .from("shared_link_clicks")
      .select("id")
      .eq("referrer_id", referrer_id)
      .eq("visitor_ip", visitor_ip)
      .or(`report_id.eq.${report_id},created_at.gte.${todayStart.toISOString()}`);

    if (existingClicks && existingClicks.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Already tracked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Cap: max 200 credits from social shares
    const { data: totalShareCredits } = await supabase
      .from("credit_transactions")
      .select("amount")
      .eq("user_id", referrer_id)
      .eq("transaction_type", "social_share");

    const totalEarned = (totalShareCredits || []).reduce(
      (sum: number, t: any) => sum + (t.amount || 0),
      0
    );

    if (totalEarned >= 200) {
      return new Response(
        JSON.stringify({ success: false, error: "Share reward cap reached (200 credits)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Record click
    await supabase.from("shared_link_clicks").insert({
      referrer_id,
      visitor_ip,
      report_id,
    });

    // 6. Credit 50 tokens (capped at remaining)
    const rewardAmount = Math.min(50, 200 - totalEarned);

    await supabase
      .from("profiles")
      .update({
        credits_balance: referrerProfile.credits_balance + rewardAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referrer_id);

    // 7. Log transaction
    await supabase.from("credit_transactions").insert({
      user_id: referrer_id,
      amount: rewardAmount,
      transaction_type: "social_share",
      description: `Partage LinkedIn — rapport ${report_id} consulté par un visiteur unique`,
    });

    return new Response(
      JSON.stringify({ success: true, credits_awarded: rewardAmount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("track-share-click error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
