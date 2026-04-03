import Stripe from "npm:stripe@14.21.0";
import { getUserClient, getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

Deno.serve(handleRequest(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = getUserClient(authHeader);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return jsonError("Unauthorized", 401);
    }

    const user = userData.user;

    // Get the user's profile to find their Stripe subscription
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return jsonError("No active subscription found", 400);
    }

    // Check if a retention coupon already exists, or create one
    const couponCode = 'RETENTION_30PCT_3MO';
    let coupon: Stripe.Coupon;

    try {
      coupon = await stripe.coupons.retrieve(couponCode);
    } catch {
      // Create the coupon if it doesn't exist
      coupon = await stripe.coupons.create({
        id: couponCode,
        percent_off: 30,
        duration: 'repeating',
        duration_in_months: 3,
        name: 'Offre fidélité -30% (3 mois)',
      });
    }

    // Check if subscription already has this coupon
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    
    if (subscription.discount?.coupon?.id === couponCode) {
      return jsonError("Retention offer already applied", 400);
    }

    // Apply coupon to the subscription
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      coupon: couponCode,
    });

    console.log(`✅ Retention coupon applied for user ${user.id} on subscription ${profile.stripe_subscription_id}`);

    return jsonOk({ success: true, discount: 30, duration_months: 3 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error applying retention offer:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));