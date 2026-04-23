import Stripe from "npm:stripe@14.21.0";
import { getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

// Annual pricing helper
const ANNUAL_CONFIG: Record<string, { product: string; monthlyAmountCents: number; lookupKey: string }> = {
  agency_pro:     { product: "prod_U4ya5iGWNTDQoE", monthlyAmountCents: 2900, lookupKey: "agency_pro_annual" },
  agency_premium: { product: "prod_UDcQ9avN4kHNFF", monthlyAmountCents: 7900, lookupKey: "agency_premium_annual" },
};

async function getOrCreateAnnualPrice(planKey: string): Promise<string> {
  const config = ANNUAL_CONFIG[planKey];
  if (!config) throw new Error(`Unknown plan: ${planKey}`);

  const existing = await stripe.prices.list({ lookup_keys: [config.lookupKey], active: true, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const annualAmountCents = Math.round(config.monthlyAmountCents * 12 * 0.9);
  const price = await stripe.prices.create({
    product: config.product,
    unit_amount: annualAmountCents,
    currency: "eur",
    recurring: { interval: "year" },
    lookup_key: config.lookupKey,
    metadata: { discount: "10pct", billing: "annual" },
  });
  return price.id;
}

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
    const body = await req.json().catch(() => ({}));
    const billing = body?.billing === 'annual' ? 'annual' : 'monthly';

    console.log(`Subscription checkout for user: ${user.id} (${billing})`);

    const origin = req.headers.get("origin") || "https://crawlers.fr";

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type, subscription_status, stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.subscription_status === "active" && profile?.plan_type === "agency_pro") {
      return jsonError("Vous avez déjà un abonnement Pro Agency actif.", 400);
    }

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

    let priceId: string;
    if (billing === 'annual') {
      priceId = await getOrCreateAnnualPrice('agency_pro');
    } else {
      const prices = await stripe.prices.list({
        product: "prod_U4ya5iGWNTDQoE",
        active: true,
        type: "recurring",
        limit: 1,
      });
      if (prices.data.length === 0) {
        return jsonError("Aucun prix récurrent trouvé pour ce produit.", 500);
      }
      priceId = prices.data[0].id;
    }

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
        billing,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: "agency_pro",
          billing,
        },
      },
      success_url: `${origin}/tarifs?subscription_success=true`,
      cancel_url: `${origin}/tarifs?subscription_canceled=true`,
    });

    return jsonOk({ url: session.url, session_id: session.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating subscription session:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));
