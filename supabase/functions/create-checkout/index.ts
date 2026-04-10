import Stripe from "npm:stripe@14.21.0";
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

// Lien de paiement Stripe fixe (utilisé en mode fallback)
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/6oU4gB6KV6hMgLb9PidnW00";

Deno.serve(handleRequest(async (req) => {
  // Gestion CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { audit_id, usePaymentLink = false } = await req.json();

    // 🔗 Mode Payment Link (fallback - prix fixe)
    if (usePaymentLink) {
      console.log(`🔗 Using fixed payment link (fallback mode)`);
      return new Response(
        JSON.stringify({ 
          url: STRIPE_PAYMENT_LINK, 
          price: 10,
          mode: 'payment_link'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation: audit_id requis pour le mode dynamique
    if (!audit_id) {
      return new Response(
        JSON.stringify({ error: "audit_id is required for dynamic pricing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📝 Checkout request for audit: ${audit_id}`);

    // 1️⃣ RÉCUPÉRATION DU PRIX DEPUIS LA BASE DE DONNÉES
    // Sécurité: le prix n'est PLUS calculé côté client ni ici
    const supabase = getServiceClient();

    const { data: audit, error: fetchError } = await supabase
      .from("audits")
      .select("id, dynamic_price, fixes_count, url, domain, user_id")
      .eq("id", audit_id)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Database error:", fetchError);
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

    // 2️⃣ CONVERSION DU PRIX EN CENTIMES
    // dynamic_price est stocké en euros (ex: 12.50)
    const priceInCents = Math.round(audit.dynamic_price * 100);

    console.log(`💸 Pricing from DB: ${audit.dynamic_price}€ (${priceInCents} cents) for ${audit.url}`);

    // Determine origin for redirect URLs
    const origin = req.headers.get("origin") || "https://crawlers.lovable.app";

    // 3️⃣ CRÉATION SESSION STRIPE avec métadonnées pour le webhook
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Crawlers.AI`,
              description: `Script correctif pour ${audit.url} (${audit.fixes_count} améliorations)`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Métadonnées pour le webhook (rapprochement post-paiement)
      metadata: {
        audit_id: audit_id,
        site_url: audit.url,
        fixes_count: String(audit.fixes_count),
        user_id: audit.user_id || '',
      },
      client_reference_id: audit_id, // Lien direct avec l'audit
      // Données du PaymentIntent (apparaît sur le reçu Stripe)
      payment_intent_data: {
        description: `Optimisation SEO/GEO pour ${audit.url}`,
        metadata: {
          site_url: audit.url,
          audit_id: audit_id,
          fixes_count: String(audit.fixes_count),
        },
      },
      // URL de redirection après paiement
      success_url: `${origin}/audit-expert?session_id={CHECKOUT_SESSION_ID}&audit_id=${audit_id}&success=true`,
      cancel_url: `${origin}/audit-expert?audit_id=${audit_id}&canceled=true`,
    });

    console.log(`✅ Checkout session created: ${session.id} for audit ${audit_id}`);

    // 4️⃣ Mise à jour de l'audit avec le stripe_session_id
    await supabase
      .from("audits")
      .update({ stripe_session_id: session.id })
      .eq("id", audit_id);

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        price: audit.dynamic_price,
        fixes_count: audit.fixes_count,
        mode: 'checkout_session',
        session_id: session.id,
        audit_id: audit_id
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
}, 'create-checkout'))
