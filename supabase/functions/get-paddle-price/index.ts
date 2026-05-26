// Résout un price_id humain (ex: "topup_50") en ID interne Paddle (pri_xxx)
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { priceId, environment } = await req.json();
    if (!priceId) return new Response(JSON.stringify({ error: "missing priceId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const env: PaddleEnv = environment === "live" ? "live" : "sandbox";
    const r = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const data = await r.json();
    if (!data.data?.length) {
      return new Response(JSON.stringify({ error: "price_not_found", priceId }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ paddleId: data.data[0].id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
