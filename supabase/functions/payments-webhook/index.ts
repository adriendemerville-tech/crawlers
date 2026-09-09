// Webhook Paddle — crédite le wallet développeur sur transaction.completed
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, EventName, type PaddleEnv } from "../_shared/paddle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const url = new URL(req.url);
  const env: PaddleEnv = url.searchParams.get("env") === "live" ? "live" : "sandbox";

  let event: any;
  try {
    const verified = await verifyWebhook(req, env);
    event = verified.event;
  } catch (e) {
    console.error("[payments-webhook] signature verification failed", e);
    return new Response("invalid_signature", { status: 401 });
  }

  console.log(`[payments-webhook] ${env} event=${event.eventType} id=${event.eventId}`);

  try {
    if (event.eventType === EventName.TransactionCompleted) {
      const txn = event.data;

      // Achat d'un audit Marina à l'unité par un visiteur sans compte :
      // on ouvre un "pass" à usage unique rattaché au jeton généré au checkout.
      if (txn.customData?.kind === "marina_oneshot") {
        const passToken = String(txn.customData?.passToken || "");
        if (!passToken) {
          console.warn("[payments-webhook] marina_oneshot without passToken", txn.id);
          return new Response("ok", { status: 200 });
        }
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { error: passErr } = await admin.from("marina_paid_passes").upsert(
          {
            pass_token: passToken,
            email: txn.customData?.email ? String(txn.customData.email).toLowerCase() : null,
            txn_id: txn.id,
            amount_cents: parseInt(txn.details?.totals?.total ?? "0", 10) || null,
            status: "granted",
          },
          { onConflict: "pass_token" },
        );
        if (passErr) {
          console.error("[payments-webhook] marina pass upsert error", passErr);
          return new Response("db_error", { status: 500 });
        }
        console.log(`[payments-webhook] marina pass granted token=${passToken.slice(0, 8)}…`);
        return new Response("ok", { status: 200 });
      }

      // Achat de la passe unique Parmenion (59 € TTC) : on active la commande et le pass.
      if (txn.customData?.kind === "parmenion_pass") {
        const orderId = String(txn.customData?.orderId || "");
        const userId = String(txn.customData?.userId || "");
        const passToken = String(txn.customData?.passToken || "");
        if (!orderId || !userId || !passToken) {
          console.warn("[payments-webhook] parmenion_pass missing orderId, userId or passToken", txn.id);
          return new Response("ok", { status: 200 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const now = new Date().toISOString();

        // Récupère le pass existant pour vérifier le montant attendu et l'état.
        const { data: existingPass } = await admin
          .from("passe_passes")
          .select("id, status, amount_cents")
          .eq("pass_token", passToken)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingPass) {
          console.warn("[payments-webhook] parmenion pass not found", passToken.slice(0, 8));
          return new Response("ok", { status: 200 });
        }

        // Vérifie le statut de la transaction Paddle.
        if (txn.status && txn.status !== "completed") {
          console.log(`[payments-webhook] parmenion transaction status=${txn.status}, skipping`);
          return new Response("ok", { status: 200 });
        }

        // Met à jour la commande seulement si elle n'est pas déjà payée.
        const { error: orderErr } = await admin.from("passe_orders").update({
          status: "paid",
          paid_at: now,
          updated_at: now,
        }).eq("id", orderId).eq("user_id", userId).neq("status", "paid");
        if (orderErr) {
          console.error("[payments-webhook] parmenion order update error", orderErr);
          return new Response("db_error", { status: 500 });
        }

        // Active le pass (idempotent grâce à la contrainte unique sur pass_token).
        const { error: passErr } = await admin.from("passe_passes").upsert(
          {
            order_id: orderId,
            user_id: userId,
            pass_token: passToken,
            txn_id: txn.id,
            amount_cents: existingPass.amount_cents || 5900,
            status: "granted",
          },
          { onConflict: "pass_token" },
        );
        if (passErr) {
          console.error("[payments-webhook] parmenion pass upsert error", passErr);
          return new Response("db_error", { status: 500 });
        }

        // Événement idempotent : on n'insère qu'une seule fois par txn_id.
        const { data: existingEvent } = await admin
          .from("passe_order_events")
          .select("id")
          .eq("order_id", orderId)
          .eq("event", "payment_received")
          .eq("payload->>txn_id", txn.id)
          .maybeSingle();

        if (!existingEvent) {
          await admin.from("passe_order_events").insert({
            order_id: orderId,
            user_id: userId,
            event: "payment_received",
            payload: {
              txn_id: txn.id,
              amount_cents: existingPass.amount_cents || 5900,
              pass_token: passToken,
            },
          });
        }

        console.log(`[payments-webhook] parmenion pass granted order=${orderId.slice(0, 8)}…`);
        return new Response("ok", { status: 200 });
      }

      const userId = txn.customData?.userId;
      if (!userId) {
        console.warn("[payments-webhook] no userId in customData, skipping", txn.id);
        return new Response("ok", { status: 200 });
      }
      // total earnings = ce que le seller reçoit après fees — on crédite ce que le user a payé (subtotal items)
      // détail items : on additionne quantity * unit_price.amount
      const items = txn.items || [];
      let totalCents = 0;
      let currency = txn.currencyCode || "EUR";
      for (const item of items) {
        const qty = item.quantity ?? 1;
        const amount = parseInt(item.price?.unitPrice?.amount ?? "0", 10);
        totalCents += qty * amount;
      }
      // Fallback : details.totals.subtotal (avant tax)
      if (totalCents === 0 && txn.details?.totals?.subtotal) {
        totalCents = parseInt(txn.details.totals.subtotal, 10);
      }
      if (totalCents <= 0) {
        console.warn("[payments-webhook] zero amount, skipping", txn.id);
        return new Response("ok", { status: 200 });
      }
      if (currency !== "EUR") {
        console.warn(`[payments-webhook] currency ${currency} != EUR, crediting raw cents anyway`);
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data, error } = await admin.rpc("dev_wallet_credit", {
        _user_id: userId,
        _amount_cents: totalCents,
        _source: "paddle",
        _source_ref: txn.id,
        _description: `Recharge Paddle (${(totalCents / 100).toFixed(2)} ${currency})`,
      });
      if (error) {
        console.error("[payments-webhook] credit error", error);
        return new Response("db_error", { status: 500 });
      }
      console.log(`[payments-webhook] credited user=${userId} +${totalCents}c -> ${data}c`);
    }

    // ═══ Remboursements (adjustment) ═══
    // Paddle envoie un adjustment pour tout remboursement, total ou partiel. On révoque
    // le pass Parmenion correspondant, on trace la commande, et pour une recharge wallet
    // on redébite le montant remboursé.
    if (event.eventType === "adjustment.created" || event.eventType === "adjustment.updated") {
      const adj = event.data;
      const action = String(adj.action ?? "");
      const status = String(adj.status ?? "");
      if (action !== "refund" && action !== "chargeback") {
        return new Response("ok", { status: 200 });
      }
      if (status && !["approved", "pending_approval"].includes(status)) {
        return new Response("ok", { status: 200 });
      }
      const txnId = String(adj.transactionId ?? adj.transaction_id ?? "");
      if (!txnId) return new Response("ok", { status: 200 });

      const refundCents = parseInt(adj.totals?.total ?? adj.payoutTotals?.total ?? "0", 10) || 0;
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const now = new Date().toISOString();

      // 1. Passe Parmenion
      const { data: pass } = await admin
        .from("passe_passes")
        .select("id, order_id, user_id, amount_cents, status")
        .eq("txn_id", txnId)
        .maybeSingle();

      if (pass) {
        if (pass.status !== "revoked") {
          await admin.from("passe_passes")
            .update({ status: "revoked", revoked_at: now, revoke_reason: action })
            .eq("id", pass.id);
        }
        await admin.from("passe_orders").update({
          status: "refunded",
          refunded_at: now,
          refund_amount_cents: refundCents || pass.amount_cents,
          refund_reason: action,
          updated_at: now,
        }).eq("id", pass.order_id).is("refunded_at", null);

        const { data: dup } = await admin.from("passe_order_events")
          .select("id").eq("order_id", pass.order_id).eq("event", "refunded")
          .eq("payload->>adjustment_id", String(adj.id ?? "")).maybeSingle();
        if (!dup) {
          await admin.from("passe_order_events").insert({
            order_id: pass.order_id,
            user_id: pass.user_id,
            event: "refunded",
            payload: { adjustment_id: adj.id ?? null, txn_id: txnId, amount_cents: refundCents, action },
          });
        }
        console.log(`[payments-webhook] parmenion refunded order=${String(pass.order_id).slice(0, 8)}…`);
        return new Response("ok", { status: 200 });
      }

      // 2. Recharge wallet développeur : on redébite (idempotent via source_ref).
      const { data: tx } = await admin
        .from("dev_wallet_transactions")
        .select("user_id")
        .eq("source_ref", txnId)
        .eq("type", "credit")
        .maybeSingle();
      if (tx?.user_id && refundCents > 0) {
        const refKey = `refund:${adj.id ?? txnId}`;
        const { data: already } = await admin
          .from("dev_wallet_transactions")
          .select("id").eq("source_ref", refKey).maybeSingle();
        if (!already) {
          const { error: debitErr } = await admin.rpc("dev_wallet_debit", {
            _user_id: tx.user_id,
            _amount_cents: refundCents,
            _source_ref: refKey,
            _description: `Remboursement Paddle (${(refundCents / 100).toFixed(2)} €)`,
          });
          if (debitErr) console.error("[payments-webhook] refund debit error", debitErr);
        }
      }
      return new Response("ok", { status: 200 });
    }

    // ═══ Paiement échoué / transaction annulée ═══
    if (event.eventType === "transaction.payment_failed" || event.eventType === "transaction.canceled") {
      const txn = event.data;
      const orderId = String(txn.customData?.orderId || "");
      const userId = String(txn.customData?.userId || "");
      if (txn.customData?.kind === "parmenion_pass" && orderId && userId) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const now = new Date().toISOString();
        await admin.from("passe_orders").update({
          payment_failed_at: now,
          updated_at: now,
        }).eq("id", orderId).eq("user_id", userId).neq("status", "paid");

        await admin.from("passe_order_events").insert({
          order_id: orderId,
          user_id: userId,
          event: "payment_failed",
          payload: { txn_id: txn.id, event: event.eventType },
        });
        console.log(`[payments-webhook] parmenion payment failed order=${orderId.slice(0, 8)}…`);
      }
      return new Response("ok", { status: 200 });
    }

    return new Response("ok", { status: 200 });

  } catch (e) {
    console.error("[payments-webhook] handler error", e);
    return new Response("handler_error", { status: 500 });
  }
});
