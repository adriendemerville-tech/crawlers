import Stripe from "npm:stripe@14.21.0";
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// Stripe webhook needs stripe-signature in addition to standard CORS headers
Deno.serve(handleRequest(async (req) => {
try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("❌ No Stripe signature found");
      return jsonError("No signature", 400);
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      return jsonError("Signature verification failed", 400);
    }

    console.log(`📥 Received Stripe event: ${event.type}`);

    // Initialize Supabase admin client
    const supabase = getServiceClient();

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log(`💳 Checkout session completed: ${session.id}`);
      console.log(`   Customer email: ${session.customer_details?.email}`);
      console.log(`   Amount: ${session.amount_total} cents`);
      console.log(`   Metadata:`, session.metadata);

      // Check if this is a credit purchase
      const transactionType = session.metadata?.transaction_type;
      
      if (transactionType === "credit_purchase") {
        // 🪙 CREDIT PURCHASE FLOW
        const userId = session.metadata?.user_id;
        const creditsAmount = parseInt(session.metadata?.credits_amount || "0", 10);
        const packageType = session.metadata?.package_type || "unknown";

        if (!userId || creditsAmount <= 0) {
          console.error("❌ Invalid credit purchase metadata:", session.metadata);
          return jsonError("Invalid credit purchase metadata", 400);
        }

        console.log(`🪙 Processing credit purchase: ${creditsAmount} credits for user ${userId}`);

        // 1️⃣ Atomic UPDATE — no SELECT needed, prevents race conditions
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update({ 
            credits_balance: supabase.rpc ? undefined : undefined, // see below
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId)
          .select("credits_balance")
          .single();

        // Use raw SQL via rpc for atomic increment
        const { data: rpcResult, error: rpcError } = await supabase.rpc('atomic_credit_update', {
          p_user_id: userId,
          p_amount: creditsAmount,
        });

        // Fallback: if RPC doesn't exist yet, use the old pattern but with a single update
        let newBalance: number;
        if (rpcError) {
          // Fallback: single atomic SQL expression via raw update
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits_balance")
            .eq("user_id", userId)
            .single();
          
          const currentBalance = profile?.credits_balance || 0;
          newBalance = currentBalance + creditsAmount;
          
          const { error: fallbackError } = await supabase
            .from("profiles")
            .update({ 
              credits_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId);

          if (fallbackError) {
            console.error("❌ Error updating credits balance:", fallbackError);
            return jsonError("Failed to update credits", 500);
          }
        } else {
          newBalance = (rpcResult as any)?.new_balance ?? 0;
        }

        // 3️⃣ Record transaction
        const { error: transactionError } = await supabase
          .from("credit_transactions")
          .insert({
            user_id: userId,
            amount: creditsAmount,
            transaction_type: "purchase",
            description: `Achat pack ${packageType} - ${creditsAmount} crédits`,
            stripe_session_id: session.id,
          });

        if (transactionError) {
          console.error("❌ Error recording transaction:", transactionError);
        }

        console.log(`✅ Credits added: +${creditsAmount} → ${newBalance} for user ${userId}`);

        // 🎁 REFERRAL REWARD: Check if this is the user's first purchase and they were referred
        try {
          // Count previous completed purchases for this user
          const { count: previousPurchases } = await supabase
            .from("credit_transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("transaction_type", "purchase");

          // If this is the first purchase (count = 1 because we just inserted one)
          if (previousPurchases !== null && previousPurchases <= 1) {
            const { data: buyerProfile } = await supabase
              .from("profiles")
              .select("referred_by")
              .eq("user_id", userId)
              .single();

            if (buyerProfile?.referred_by) {
              const referrerId = buyerProfile.referred_by;
              const referralBonus = 20;

              // Atomic increment for referrer too
              const { error: refRpcError } = await supabase.rpc('atomic_credit_update', {
                p_user_id: referrerId,
                p_amount: referralBonus,
              });

              if (refRpcError) {
                // Fallback
                const { data: referrerProfile } = await supabase
                  .from("profiles")
                  .select("credits_balance")
                  .eq("user_id", referrerId)
                  .single();

                if (referrerProfile) {
                  const referrerNewBalance = (referrerProfile.credits_balance || 0) + referralBonus;
                  await supabase
                    .from("profiles")
                    .update({ credits_balance: referrerNewBalance, updated_at: new Date().toISOString() })
                    .eq("user_id", referrerId);
                }
              }

              await supabase
                .from("credit_transactions")
                .insert({
                  user_id: referrerId,
                  amount: referralBonus,
                  transaction_type: "bonus",
                  description: `Récompense parrainage — filleul a effectué son premier achat`,
                });

              await supabase
                .from("referral_rewards")
                .insert({
                  referrer_id: referrerId,
                  referee_id: userId,
                  reward_amount: referralBonus,
                  status: "completed",
                });

              console.log(`🎁 Referral reward: +${referralBonus} credits to referrer ${referrerId}`);
            }
          }
        } catch (refErr) {
          console.error("⚠️ Referral reward error (non-blocking):", refErr);
        }

        return jsonOk({ 
            received: true, 
            type: "credit_purchase",
            user_id: userId,
            credits_added: creditsAmount,
            new_balance: newBalance,
          });
      }

      // 🛒 SCRIPT PURCHASE FLOW (existing logic)
      const auditId = session.metadata?.audit_id || session.client_reference_id;
      const siteUrl = session.metadata?.site_url || "unknown";
      const fixesCount = parseInt(session.metadata?.fixes_count || "0", 10);
      const userId = session.metadata?.user_id || null;

      // 1️⃣ INSERT payment record in stripe_payments (for legacy compatibility)
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
      } else {
        console.log(`✅ Payment record created: ${paymentRecord.id}`);
      }

      // 2️⃣ UPDATE the audits table: mark as PAID
      if (auditId) {
        const { error: updateAuditError } = await supabase
          .from("audits")
          .update({ 
            payment_status: "paid",
            stripe_payment_intent_id: session.payment_intent as string,
            updated_at: new Date().toISOString()
          })
          .eq("id", auditId);

        if (updateAuditError) {
          console.error(`❌ Error updating audit ${auditId}:`, updateAuditError);
        } else {
          console.log(`✅ Audit ${auditId} marked as PAID`);
        }
      } else {
        console.warn("⚠️ No audit_id found in session metadata");
      }

      return jsonOk({ 
          received: true, 
          session_id: session.id,
          audit_id: auditId,
          status: "completed" 
        });
    }

    // Handle payment_intent.succeeded for additional confirmation
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`💰 Payment intent succeeded: ${paymentIntent.id}`);
      
      // Update stripe_payments
      const { error: updateError } = await supabase
        .from("stripe_payments")
        .update({ status: "succeeded" })
        .eq("stripe_payment_intent_id", paymentIntent.id);
      
      if (updateError) {
        console.error("❌ Error updating payment status:", updateError);
      }

      // Also update audits table
      const { error: updateAuditError } = await supabase
        .from("audits")
        .update({ payment_status: "paid" })
        .eq("stripe_payment_intent_id", paymentIntent.id);

      if (updateAuditError) {
        console.error("❌ Error updating audit payment status:", updateAuditError);
      }
    }

    // Handle subscription events
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const planType = subscription.metadata?.plan_type || "agency_pro";
      const billingPeriod = subscription.metadata?.billing || 
        (subscription.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly');

      if (userId) {
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;
        
        const effectiveStatus = isActive
          ? (cancelAtPeriodEnd ? "canceling" : "active")
          : subscription.status;

        // Extract period end date from subscription
        const periodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        const { error: subError } = await supabase
          .from("profiles")
          .update({
            plan_type: isActive ? planType : "free",
            subscription_status: effectiveStatus,
            stripe_subscription_id: subscription.id,
            billing_period: isActive ? billingPeriod : 'monthly',
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (subError) {
          console.error("Error updating subscription status:", subError);
        } else {
          console.log(`Subscription ${subscription.id} -> ${effectiveStatus} (${billingPeriod}) for user ${userId}`);
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        const { error: subError } = await supabase
          .from("profiles")
          .update({
            plan_type: "free",
            subscription_status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (subError) {
          console.error("❌ Error canceling subscription:", subError);
        } else {
          console.log(`✅ Subscription canceled for user ${userId}`);
        }
      }
    }

    // Handle failed payments
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
      
      await supabase
        .from("stripe_payments")
        .update({ status: "failed" })
        .eq("stripe_payment_intent_id", paymentIntent.id);

      await supabase
        .from("audits")
        .update({ payment_status: "failed" })
        .eq("stripe_payment_intent_id", paymentIntent.id);
    }

    // Return 200 for all other events
    return jsonOk({ received: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Webhook handler error:", errorMessage);
    return jsonError(errorMessage, 500);
  }
}));