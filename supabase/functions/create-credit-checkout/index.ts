import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Credit packages configuration
const CREDIT_PACKAGES = {
  essential: { credits: 10, price_cents: 500, name: "Essentiel" },
  pro: { credits: 50, price_cents: 1900, name: "Pro" },
  premium: { credits: 150, price_cents: 4500, name: "Premium" },
} as const;

type PackageType = keyof typeof CREDIT_PACKAGES;

serve(async (req) => {
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

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
        JSON.stringify({ error: "Invalid package type. Must be: essential, pro, or premium" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pkg = CREDIT_PACKAGES[package_type as PackageType];
    console.log(`💳 Creating checkout for ${pkg.name}: ${pkg.credits} credits @ ${pkg.price_cents / 100}€`);

    // Determine origin for redirect
    const origin = req.headers.get("origin") || "https://crawlers.lovable.app";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Crawlers.AI - Pack ${pkg.name}`,
              description: `${pkg.credits} crédits pour débloquer vos scripts correctifs`,
            },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        },
      ],
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
