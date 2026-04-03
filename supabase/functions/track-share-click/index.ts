import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
try {
    const { report_id, referrer_id, visitor_ip } = await req.json();

    if (!report_id || !referrer_id || !visitor_ip) {
      return jsonOk({ success: false, error: "Missing parameters" }, 400);
    }

    const supabase = getServiceClient();

    // 1. Check referrer exists
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("user_id, credits_balance")
      .eq("user_id", referrer_id)
      .single();

    if (!referrerProfile) {
      return jsonOk({ success: false, error: "Referrer not found" }, 404);
    }

    // 2. Self-click check: get visitor from auth header if available
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonClient = getUserClient(authHeader);
      const { data: { user } } = await anonClient.auth.getUser();
      if (user && user.id === referrer_id) {
        return jsonOk({ success: false, error: "Self-click not rewarded" });
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
      return jsonOk({ success: false, error: "Already tracked" });
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
      return jsonOk({ success: false, error: "Share reward cap reached (200 credits)" });
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

    return jsonOk({ success: true, credits_awarded: rewardAmount });
  } catch (e) {
    console.error("track-share-click error:", e);
    return jsonOk({ success: false, error: e.message }, 500);
  }
}));