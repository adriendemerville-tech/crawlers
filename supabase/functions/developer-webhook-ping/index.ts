// Ping de test pour les webhooks développeurs — envoie un événement "ping" signé HMAC.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmacSign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { webhook_id } = await req.json();
    if (!webhook_id) return new Response(JSON.stringify({ error: "missing webhook_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: hook } = await admin
      .from("developer_webhooks")
      .select("id, user_id, url, secret, api")
      .eq("id", webhook_id)
      .eq("user_id", u.id)
      .maybeSingle();
    if (!hook) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = JSON.stringify({
      event: "ping",
      api: hook.api,
      data: { message: "Webhook test ping from Crawlers Developer Platform" },
      sent_at: new Date().toISOString(),
    });
    const sig = await hmacSign(hook.secret, body);

    let status = 0, responseBody = "", err: string | null = null;
    try {
      const r = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Crawlers-Event": "ping",
          "X-Crawlers-Signature": sig,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = r.status;
      responseBody = (await r.text()).slice(0, 1000);
    } catch (e) {
      err = (e as Error).message;
    }

    await admin.from("webhook_deliveries").insert({
      webhook_id: hook.id, user_id: u.id, event: "ping",
      payload: JSON.parse(body), attempts: 1,
      status: status >= 200 && status < 300 ? "delivered" : "failed",
      response_status: status || null, response_body: responseBody || null, error: err,
      delivered_at: status >= 200 && status < 300 ? new Date().toISOString() : null,
    });
    await admin.from("developer_webhooks")
      .update({ last_ping_at: new Date().toISOString(), last_status: status || null })
      .eq("id", hook.id);

    return new Response(JSON.stringify({ ok: status >= 200 && status < 300, status, body: responseBody, error: err }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
