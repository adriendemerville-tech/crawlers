import Stripe from "https://esm.sh/stripe@14.21.0";
import { getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;
    console.log(`📝 Subscription checkout for user: ${user.id}`);

    const origin = req.headers.get("origin") || "https://crawlers.lovable.app";

    // Check if user already has an active subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type, subscription_status, stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.subscription_status === "active" && profile?.plan_type === "agency_pro") {
      return new Response(
        JSON.stringify({ error: "Vous avez déjà un abonnement Pro Agency actif." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or retrieve Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Find the recurring price for the Pro Agency product
    const prices = await stripe.prices.list({
      product: "prod_U4ya5iGWNTDQoE",
      active: true,
      type: "recurring",
      limit: 1,
    });

    if (prices.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun prix récurrent trouvé pour ce produit." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = prices.data[0].id;
    console.log(`💰 Using price: ${priceId}`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: {
        user_id: user.id,
        user_email: user.email || "",
        transaction_type: "subscription",
        plan_type: "agency_pro",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: "agency_pro",
        },
      },
      success_url: `${origin}/tarifs?subscription_success=true`,
      cancel_url: `${origin}/tarifs?subscription_canceled=true`,
    });

    console.log(`✅ Subscription session created: ${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error creating subscription session:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
