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
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[payments-webhook] handler error", e);
    return new Response("handler_error", { status: 500 });
  }
});
