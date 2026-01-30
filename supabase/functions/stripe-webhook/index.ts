import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("❌ No Stripe signature found");
      return new Response(
        JSON.stringify({ error: "No signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📥 Received Stripe event: ${event.type}`);

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log(`💳 Checkout session completed: ${session.id}`);
      console.log(`   Customer email: ${session.customer_details?.email}`);
      console.log(`   Amount: ${session.amount_total} cents`);

      // Initialize Supabase admin client
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Extract metadata from session (if passed during checkout creation)
      const siteUrl = session.metadata?.site_url || session.client_reference_id || "unknown";
      const fixesCount = parseInt(session.metadata?.fixes_count || "0", 10);
      const userId = session.metadata?.user_id || null;

      // Insert payment record
      const { data: paymentRecord, error: insertError } = await supabase
        .from("stripe_payments")
        .insert({
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          email: session.customer_details?.email || null,
          user_id: userId,
          site_url: siteUrl,
          amount_cents: session.amount_total || 0,
          currency: session.currency || "eur",
          status: "completed",
          fixes_count: fixesCount,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error inserting payment record:", insertError);
        // Don't fail the webhook - Stripe will retry
      } else {
        console.log(`✅ Payment record created: ${paymentRecord.id}`);
      }

      // Return success
      return new Response(
        JSON.stringify({ 
          received: true, 
          session_id: session.id,
          status: "completed" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle payment_intent.succeeded for additional confirmation
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`💰 Payment intent succeeded: ${paymentIntent.id}`);
      
      // Update existing record if needed
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabase
        .from("stripe_payments")
        .update({ status: "succeeded" })
        .eq("stripe_payment_intent_id", paymentIntent.id);
      
      if (updateError) {
        console.error("❌ Error updating payment status:", updateError);
      }
    }

    // Handle failed payments
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from("stripe_payments")
        .update({ status: "failed" })
        .eq("stripe_payment_intent_id", paymentIntent.id);
    }

    // Return 200 for all other events
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Webhook handler error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
