import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { verifyBotBatch } from '../_shared/bot-verification.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Bot detection maps ──
const BOT_PATTERNS: Array<{ pattern: RegExp; name: string; category: string }> = [
  // AI crawlers
  { pattern: /GPTBot/i, name: "GPTBot", category: "ai_crawler" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", category: "ai_crawler" },
  { pattern: /Google-Extended/i, name: "Google-Extended", category: "ai_crawler" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot", category: "ai_crawler" },
  { pattern: /Claude-Web/i, name: "Claude-Web", category: "ai_crawler" },
  { pattern: /anthropic-ai/i, name: "Anthropic", category: "ai_crawler" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", category: "ai_crawler" },
  { pattern: /Bytespider/i, name: "Bytespider", category: "ai_crawler" },
  { pattern: /CCBot/i, name: "CCBot", category: "ai_crawler" },
  { pattern: /cohere-ai/i, name: "Cohere", category: "ai_crawler" },
  { pattern: /Diffbot/i, name: "Diffbot", category: "ai_crawler" },
  { pattern: /FacebookBot/i, name: "FacebookBot", category: "ai_crawler" },
  { pattern: /ImagesiftBot/i, name: "ImagesiftBot", category: "ai_crawler" },
  { pattern: /Applebot-Extended/i, name: "Applebot-Extended", category: "ai_crawler" },
  // Search engines
  { pattern: /Googlebot/i, name: "Googlebot", category: "search_engine" },
  { pattern: /bingbot/i, name: "Bingbot", category: "search_engine" },
  { pattern: /Baiduspider/i, name: "Baiduspider", category: "search_engine" },
  { pattern: /YandexBot/i, name: "YandexBot", category: "search_engine" },
  { pattern: /DuckDuckBot/i, name: "DuckDuckBot", category: "search_engine" },
  { pattern: /Applebot(?!-Extended)/i, name: "Applebot", category: "search_engine" },
  // SEO tools
  { pattern: /AhrefsBot/i, name: "AhrefsBot", category: "seo_tool" },
  { pattern: /SemrushBot/i, name: "SemrushBot", category: "seo_tool" },
  { pattern: /MJ12bot/i, name: "MajesticBot", category: "seo_tool" },
  { pattern: /DotBot/i, name: "DotBot", category: "seo_tool" },
  { pattern: /Screaming Frog/i, name: "Screaming Frog", category: "seo_tool" },
  { pattern: /DataForSEO/i, name: "DataForSEO", category: "seo_tool" },
  // Social
  { pattern: /Twitterbot/i, name: "Twitterbot", category: "social" },
  { pattern: /LinkedInBot/i, name: "LinkedInBot", category: "social" },
  { pattern: /facebookexternalhit/i, name: "Facebook", category: "social" },
  { pattern: /Slackbot/i, name: "Slackbot", category: "social" },
  { pattern: /TelegramBot/i, name: "TelegramBot", category: "social" },
  { pattern: /WhatsApp/i, name: "WhatsApp", category: "social" },
  // Generic bot catch-all
  { pattern: /bot|crawl|spider|slurp|fetch/i, name: "Unknown Bot", category: "unknown" },
];

function detectBot(ua: string | null): { isBot: boolean; name: string | null; category: string | null } {
  if (!ua) return { isBot: false, name: null, category: null };
  for (const bp of BOT_PATTERNS) {
    if (bp.pattern.test(ua)) {
      return { isBot: true, name: bp.name, category: bp.category };
    }
  }
  return { isBot: false, name: null, category: null };
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface LogEntry {
  ts?: string;
  ip?: string;
  ua?: string;
  method?: string;
  path?: string;
  status?: number;
  bytes?: number;
  referer?: string;
  country?: string;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { api_key, logs } = body as { api_key?: string; logs?: LogEntry[] };

    if (!api_key) {
      return new Response(JSON.stringify({ error: "Missing api_key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return new Response(JSON.stringify({ error: "No logs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap batch size
    const batch = logs.slice(0, 500);

    // Hash the key to compare with stored hash
    const keyHash = await hashKey(api_key);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the connector matching this key hash
    const { data: connector, error: connErr } = await supabase
      .from("log_connectors")
      .select("id, tracked_site_id, user_id, type, status")
      .eq("api_key_hash", keyHash)
      .maybeSingle();

    if (connErr || !connector) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérification multi-couches (rDNS + ASN + UA), batch et cache par IP
    const verifications = await verifyBotBatch(
      batch.map((log) => ({ ip: log.ip, ua: log.ua })),
      { enableRdns: true, rdnsConcurrency: 8 },
    );

    const rows = batch.map((log, i) => {
      const v = verifications[i];
      return {
        tracked_site_id: connector.tracked_site_id,
        connector_id: connector.id,
        ts: log.ts || new Date().toISOString(),
        ip: log.ip || null,
        user_agent: log.ua || null,
        method: log.method || "GET",
        path: log.path || "/",
        status_code: log.status || null,
        bytes_sent: log.bytes || null,
        referer: log.referer || null,
        country_code: log.country || null,
        is_bot: v.is_bot,
        bot_name: v.bot_name,
        bot_category: v.bot_category,
        verification_status: v.status,
        verification_method: v.method,
        confidence_score: v.confidence,
        source: connector.type || "cloudflare",
        raw: log,
      };
    });

    const { error: insertErr } = await supabase.from("log_entries").insert(rows);

    if (insertErr) {
      console.error("[ingest-bot-logs] Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Insert failed", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_sync_at on connector
    await supabase
      .from("log_connectors")
      .update({ last_sync_at: new Date().toISOString(), status: "active", error_count: 0 })
      .eq("id", connector.id);

    return new Response(
      JSON.stringify({ success: true, inserted: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ingest-bot-logs] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}, 'ingest-bot-logs'))
