import Stripe from "npm:stripe@14.21.0";
import { getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

// Credit packages configuration — mapped to real Stripe products
const CREDIT_PACKAGES = {
  essential: { credits: 10, price_cents: 500, name: "Essentiel", stripe_product_id: "prod_Tt71HPd497Zx9V" },
  pro:       { credits: 50, price_cents: 1900, name: "Pro",       stripe_product_id: "prod_U4yjVH7b8EhmQF" },
  premium:   { credits: 150, price_cents: 4500, name: "Premium",  stripe_product_id: "prod_U4ykI3KfQMFKNe" },
  ultimate:  { credits: 500, price_cents: 9900, name: "Ultime",   stripe_product_id: "prod_U8OU3uivREIjpQ" },
} as const;

type PackageType = keyof typeof CREDIT_PACKAGES;

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const supabase = getUserClient(authHeader);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;
    console.log(`📝 Credit checkout for user: ${user.id}`);

    // Parse request body
    const { package_type } = await req.json();

    if (!package_type || !CREDIT_PACKAGES[package_type as PackageType]) {
      return new Response(
        JSON.stringify({ error: "Invalid package type. Must be: essential, pro, premium, or ultimate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pkg = CREDIT_PACKAGES[package_type as PackageType];
    console.log(`💳 Creating checkout for ${pkg.name}: ${pkg.credits} credits (product: ${pkg.stripe_product_id})`);

    // Fetch the active one-time price for this Stripe product
    const prices = await stripe.prices.list({
      product: pkg.stripe_product_id,
      active: true,
      type: "one_time",
      limit: 1,
    });

    if (!prices.data.length) {
      console.error(`No active price found for product ${pkg.stripe_product_id}`);
      return new Response(
        JSON.stringify({ error: "No active price found for this package" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = prices.data[0].id;
    console.log(`🏷️ Using price: ${priceId}`);

    // Determine origin for redirect
    const origin = req.headers.get("origin") || "https://crawlers.lovable.app";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      metadata: {
        user_id: user.id,
        user_email: user.email || "",
        package_type: package_type,
        credits_amount: String(pkg.credits),
        transaction_type: "credit_purchase",
      },
      customer_email: user.email,
      success_url: `${origin}/audit-expert?credits_success=true&credits=${pkg.credits}`,
      cancel_url: `${origin}/audit-expert?credits_canceled=true`,
    });

    console.log(`✅ Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        credits: pkg.credits,
        price: pkg.price_cents / 100,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error creating credit checkout:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
