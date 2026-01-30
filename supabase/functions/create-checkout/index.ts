import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 💰 CONFIGURATION DU PRICING
const BASE_PRICE_CENTS = 1000; // 10.00€
const FLOOR_PRICE_CENTS = 200; // 2.00€ (Min)
const CAP_PRICE_CENTS = 1900;  // 19.00€ (Max)

// Lien de paiement Stripe fixe (utilisé en mode fallback ou direct)
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/6oU4gB6KV6hMgLb9PidnW00";

// Facteurs de pondération (0.2 à 1.9)
const SECTOR_FACTORS: Record<string, number> = {
  'personal': 0.2,    // -> 2€
  'blog': 0.3,        // -> 3€
  'association': 0.4, // -> 4€
  'local_business': 0.8, // -> 8€
  'consulting': 1.2,  // -> 12€
  'startup': 1.5,     // -> 15€
  'ecommerce': 1.8,   // -> 18€
  'finance': 1.9,     // -> 19€
  'default': 1.0      // -> 10€
};

serve(async (req) => {
  // Gestion CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { siteUrl, sector = 'default', fixesCount = 0, userId = null, usePaymentLink = false } = await req.json();

    console.log(`📝 Checkout request for: ${siteUrl}, sector: ${sector}, fixes: ${fixesCount}`);

    // 🔗 Mode Payment Link (redirection directe vers lien Stripe fixe)
    if (usePaymentLink) {
      console.log(`🔗 Using fixed payment link for ${siteUrl}`);
      return new Response(
        JSON.stringify({ 
          url: STRIPE_PAYMENT_LINK, 
          price: 10, // Prix fixe du payment link
          mode: 'payment_link'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1️⃣ CALCUL DU PRIX DYNAMIQUE
    // Récupération du facteur (fallback sur 'default' si inconnu)
    const factor = SECTOR_FACTORS[sector] || SECTOR_FACTORS['default'];
    
    // Calcul brut
    let calculatedPrice = Math.round(BASE_PRICE_CENTS * factor);

    // Application des bornes (Clamping)
    if (calculatedPrice < FLOOR_PRICE_CENTS) calculatedPrice = FLOOR_PRICE_CENTS;
    if (calculatedPrice > CAP_PRICE_CENTS) calculatedPrice = CAP_PRICE_CENTS;

    console.log(`💸 Pricing pour ${siteUrl}: Secteur=${sector} (x${factor}) -> ${calculatedPrice / 100}€`);

    // 2️⃣ CRÉATION SESSION STRIPE avec métadonnées pour le webhook
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Pack Optimisation Expert`,
              description: `Script correctif pour ${siteUrl} (${fixesCount} améliorations)`,
            },
            unit_amount: calculatedPrice, // Le prix dynamique
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Métadonnées pour le webhook
      metadata: {
        site_url: siteUrl,
        sector: sector,
        fixes_count: String(fixesCount),
        user_id: userId || '',
      },
      client_reference_id: siteUrl,
      // URL de redirection après paiement
      success_url: `${req.headers.get("origin")}/audit-expert?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${req.headers.get("origin")}/audit-expert?canceled=true`,
    });

    console.log(`✅ Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        price: calculatedPrice / 100,
        mode: 'checkout_session',
        session_id: session.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("❌ Error creating checkout session:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
