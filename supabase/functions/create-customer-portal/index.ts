import Stripe from "npm:stripe@14.21.0";
import { getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
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
    const origin = req.headers.get("origin") || "https://crawlers.lovable.app";

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return jsonError("Aucun compte Stripe trouvé.", 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/console?tab=wallet`,
    });

    return jsonOk({ url: session.url });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error creating portal session:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));