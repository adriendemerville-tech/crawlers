import Stripe from "npm:stripe@14.21.0";
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/6oU4gB6KV6hMgLb9PidnW00";

const CREDIT_PACKAGES = {
  essential: { credits: 10, price_cents: 500, name: "Essentiel", stripe_product_id: "prod_Tt71HPd497Zx9V" },
  pro:       { credits: 50, price_cents: 1900, name: "Pro",       stripe_product_id: "prod_U4yjVH7b8EhmQF" },
  premium:   { credits: 150, price_cents: 4500, name: "Premium",  stripe_product_id: "prod_U4ykI3KfQMFKNe" },
  ultimate:  { credits: 500, price_cents: 9900, name: "Ultime",   stripe_product_id: "prod_U8OU3uivREIjpQ" },
} as const;

type PackageType = keyof typeof CREDIT_PACKAGES;

// Annual pricing: -10% discount
const ANNUAL_PRICES: Record<string, { product: string; monthlyAmountCents: number; lookupKey: string }> = {
  agency_pro:     { product: "prod_U4ya5iGWNTDQoE", monthlyAmountCents: 2900, lookupKey: "agency_pro_annual" },
  agency_premium: { product: "prod_UDcQ9avN4kHNFF", monthlyAmountCents: 7900, lookupKey: "agency_premium_annual" },
};

async function getOrCreateAnnualPrice(planKey: string): Promise<string> {
  const config = ANNUAL_PRICES[planKey];
  if (!config) throw new Error(`Unknown plan: ${planKey}`);

  // Try to find existing annual price by lookup_key
  const existing = await stripe.prices.list({
    lookup_keys: [config.lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) return existing.data[0].id;

  // Create annual price: -10% → multiply monthly by 12 * 0.9
  const annualAmountCents = Math.round(config.monthlyAmountCents * 12 * 0.9);
  const price = await stripe.prices.create({
    product: config.product,
    unit_amount: annualAmountCents,
    currency: "eur",
    recurring: { interval: "year" },
    lookup_key: config.lookupKey,
    metadata: { discount: "10pct", billing: "annual" },
  });
  console.log(`Created annual price for ${planKey}: ${price.id} (${annualAmountCents} cents/year)`);
  return price.id;
}

// ─── Helpers ───

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = getUserClient(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}

// ─── Action handlers ───

async function handleCheckout(req: Request, body: any) {
  const { audit_id, usePaymentLink = false } = body;

  if (usePaymentLink) {
    return json({ url: STRIPE_PAYMENT_LINK, price: 10, mode: 'payment_link' });
  }

  if (!audit_id) return json({ error: "audit_id is required for dynamic pricing" }, 400);

  const supabase = getServiceClient();
  const { data: audit, error: fetchError } = await supabase
    .from("audits")
    .select("id, dynamic_price, fixes_count, url, domain, user_id")
    .eq("id", audit_id)
    .maybeSingle();

  if (fetchError) return json({ error: "Database error" }, 500);
  if (!audit) return json({ error: "Audit not found" }, 404);

  const priceInCents = Math.round(audit.dynamic_price * 100);
  const origin = req.headers.get("origin") || "https://crawlers.fr";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: "Crawlers.AI",
          description: `Script correctif pour ${audit.url} (${audit.fixes_count} améliorations)`,
        },
        unit_amount: priceInCents,
      },
      quantity: 1,
    }],
    mode: "payment",
    metadata: { audit_id, site_url: audit.url, fixes_count: String(audit.fixes_count), user_id: audit.user_id || '' },
    client_reference_id: audit_id,
    payment_intent_data: {
      description: `Optimisation SEO/GEO pour ${audit.url}`,
      metadata: { site_url: audit.url, audit_id, fixes_count: String(audit.fixes_count) },
    },
    success_url: `${origin}/audit-expert?session_id={CHECKOUT_SESSION_ID}&audit_id=${audit_id}&success=true`,
    cancel_url: `${origin}/audit-expert?audit_id=${audit_id}&canceled=true`,
  });

  await supabase.from("audits").update({ stripe_session_id: session.id }).eq("id", audit_id);

  return json({ url: session.url, price: audit.dynamic_price, fixes_count: audit.fixes_count, mode: 'checkout_session', session_id: session.id, audit_id });
}

async function handleCreditCheckout(req: Request, body: any) {
  const auth = await getAuthUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const { package_type } = body;
  if (!package_type || !CREDIT_PACKAGES[package_type as PackageType]) {
    return json({ error: "Invalid package type. Must be: essential, pro, premium, or ultimate" }, 400);
  }

  const pkg = CREDIT_PACKAGES[package_type as PackageType];
  const prices = await stripe.prices.list({ product: pkg.stripe_product_id, active: true, type: "one_time", limit: 1 });
  if (!prices.data.length) return json({ error: "No active price found for this package" }, 500);

  const origin = req.headers.get("origin") || "https://crawlers.fr";
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    mode: "payment",
    metadata: {
      user_id: auth.user.id,
      user_email: auth.user.email || "",
      package_type,
      credits_amount: String(pkg.credits),
      transaction_type: "credit_purchase",
    },
    customer_email: auth.user.email,
    success_url: `${origin}/audit-expert?credits_success=true&credits=${pkg.credits}`,
    cancel_url: `${origin}/audit-expert?credits_canceled=true`,
  });

  return json({ url: session.url, session_id: session.id, credits: pkg.credits, price: pkg.price_cents / 100 });
}

async function handleSubscription(req: Request, body: any) {
  const auth = await getAuthUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const billing = body?.billing === 'annual' ? 'annual' : 'monthly';
  const origin = req.headers.get("origin") || "https://crawlers.fr";
  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("plan_type, subscription_status, stripe_subscription_id")
    .eq("user_id", auth.user.id)
    .single();

  if (profile?.subscription_status === "active" && profile?.plan_type === "agency_pro") {
    return json({ error: "Vous avez déjà un abonnement Pro Agency actif." }, 400);
  }

  const customers = await stripe.customers.list({ email: auth.user.email, limit: 1 });
  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({ email: auth.user.email || undefined, metadata: { supabase_user_id: auth.user.id } });
    customerId = customer.id;
  }

  let priceId: string;
  if (billing === 'annual') {
    priceId = await getOrCreateAnnualPrice('agency_pro');
  } else {
    const prices = await stripe.prices.list({ product: "prod_U4ya5iGWNTDQoE", active: true, type: "recurring", limit: 1 });
    if (!prices.data.length) return json({ error: "Aucun prix récurrent trouvé pour ce produit." }, 500);
    priceId = prices.data[0].id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    metadata: { user_id: auth.user.id, user_email: auth.user.email || "", transaction_type: "subscription", plan_type: "agency_pro", billing },
    subscription_data: { metadata: { user_id: auth.user.id, plan_type: "agency_pro", billing } },
    success_url: `${origin}/tarifs?subscription_success=true`,
    cancel_url: `${origin}/tarifs?subscription_canceled=true`,
  });

  return json({ url: session.url, session_id: session.id });
}

async function handleSubscriptionPremium(req: Request, body: any) {
  const auth = await getAuthUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const billing = body?.billing === 'annual' ? 'annual' : 'monthly';
  const origin = req.headers.get("origin") || "https://crawlers.fr";
  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("plan_type, subscription_status, stripe_subscription_id")
    .eq("user_id", auth.user.id)
    .single();

  if (profile?.subscription_status === "active" && profile?.plan_type === "agency_premium") {
    return json({ error: "Vous avez déjà un abonnement Pro Agency + actif." }, 400);
  }

  const customers = await stripe.customers.list({ email: auth.user.email, limit: 1 });
  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({ email: auth.user.email || undefined, metadata: { supabase_user_id: auth.user.id } });
    customerId = customer.id;
  }

  let priceId: string;
  if (billing === 'annual') {
    priceId = await getOrCreateAnnualPrice('agency_premium');
  } else {
    const prices = await stripe.prices.list({ product: "prod_UDcQ9avN4kHNFF", active: true, type: "recurring", limit: 1 });
    if (!prices.data.length) return json({ error: "Aucun prix récurrent trouvé pour ce produit Premium." }, 500);
    priceId = prices.data[0].id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    metadata: { user_id: auth.user.id, user_email: auth.user.email || "", transaction_type: "subscription", plan_type: "agency_premium", billing },
    subscription_data: { metadata: { user_id: auth.user.id, plan_type: "agency_premium", billing } },
    success_url: `${origin}/tarifs?subscription_success=true`,
    cancel_url: `${origin}/tarifs?subscription_canceled=true`,
  });

  return json({ url: session.url, session_id: session.id });
}

async function handlePortal(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const origin = req.headers.get("origin") || "https://crawlers.fr";
  const customers = await stripe.customers.list({ email: auth.user.email, limit: 1 });
  if (!customers.data.length) return json({ error: "Aucun compte Stripe trouvé." }, 404);

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${origin}/console?tab=wallet`,
  });

  return json({ url: session.url });
}

async function handleRetention(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('user_id', auth.user.id)
    .single();

  if (!profile?.stripe_subscription_id) return json({ error: "No active subscription found" }, 400);

  const couponCode = 'RETENTION_30PCT_3MO';
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(couponCode);
  } catch {
    coupon = await stripe.coupons.create({ id: couponCode, percent_off: 30, duration: 'repeating', duration_in_months: 3, name: 'Offre fidélité -30% (3 mois)' });
  }

  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  if (subscription.discount?.coupon?.id === couponCode) return json({ error: "Retention offer already applied" }, 400);

  await stripe.subscriptions.update(profile.stripe_subscription_id, { coupon: couponCode });
  return json({ success: true, discount: 30, duration_months: 3 });
}

// ─── Router ───

Deno.serve(handleRequest(async (req) => {
try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'checkout':          return await handleCheckout(req, body);
      case 'credit-checkout':   return await handleCreditCheckout(req, body);
      case 'subscription':      return await handleSubscription(req, body);
      case 'subscription_premium': return await handleSubscriptionPremium(req, body);
      case 'portal':            return await handlePortal(req);
      case 'retention':         return await handleRetention(req);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("❌ stripe-actions error:", msg);
    return json({ error: msg }, 500);
  }
}));