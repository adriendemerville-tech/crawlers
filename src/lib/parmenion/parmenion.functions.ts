import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PARMENION_PRICE_ID = "parmenion_59_eur";
const PARMENION_PRODUCT_ID = "parmenion_pass";
const PARMENION_AMOUNT_CENTS = 5900;

export const createParmenionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        url: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    if (!userId) {
      return { error: "unauthenticated" as const };
    }

    const passToken = crypto.randomUUID();

    const { data: order, error: orderErr } = await supabase
      .from("passe_orders")
      .insert({
        user_id: userId,
        url: data.url,
        status: "created",
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("[createParmenionOrder] insert error", orderErr);
      return { error: "insert_failed" as const };
    }

    const { error: passErr } = await supabase.from("passe_passes").insert({
      order_id: order.id,
      user_id: userId,
      pass_token: passToken,
      amount_cents: PARMENION_AMOUNT_CENTS,
      status: "pending",
    });

    if (passErr) {
      console.error("[createParmenionOrder] pass insert error", passErr);
      return { error: "insert_failed" as const };
    }

    await supabase.from("passe_order_events").insert({
      order_id: order.id,
      user_id: userId,
      event: "created",
      payload: {
        url: data.url,
        price_id: PARMENION_PRICE_ID,
        product_id: PARMENION_PRODUCT_ID,
        amount_cents: PARMENION_AMOUNT_CENTS,
      },
    });

    return {
      orderId: order.id,
      passToken,
      priceId: PARMENION_PRICE_ID,
      amountCents: PARMENION_AMOUNT_CENTS,
    };
  });
