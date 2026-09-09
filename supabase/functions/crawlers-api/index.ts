// Crawlers API — Router REST unifié
// Auth : header `Authorization: Bearer crw_live_...` ou `x-crawlers-key`
// Endpoints : /v1/features, /v1/jobs (POST), /v1/jobs/{id} (GET), /v1/jobs/{id}/cancel (POST)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crawlers-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Catalogue des features exposées. status: "stable" | "preview" | "soon"
// `fn` = edge function interne wirée (null = pas encore exécutable, le job restera "queued")
const FEATURES = [
  { id: "audit_expert",         status: "stable",  fn: "audit-expert-seo",             desc: "Audit Expert 168 critères (technique + sémantique + EEAT)", input: { url: "string" } },
  { id: "machine_layer",        status: "stable",  fn: "machine-layer-scan",           desc: "Machine Layer Scanner (lisibilité bots IA, JSON-LD, robots, sitemap)", input: { url: "string" } },
  { id: "eeat",                 status: "stable",  fn: "check-eeat",                   desc: "Score E-E-A-T détaillé (expertise, autorité, fiabilité)", input: { url: "string" } },
  { id: "site_crawl",           status: "stable",  fn: "crawl-site",                   desc: "Crawl d'un site (BFS depth 3 max)", input: { domain: "string", depth: "number?", limit: "number?" } },
  { id: "pagespeed",            status: "stable",  fn: "check-pagespeed",              desc: "PageSpeed Insights (mobile + desktop) + Core Web Vitals", input: { url: "string" } },
  { id: "audit_matrix",         status: "stable",  fn: "audit-matrice",                desc: "Matrice d'audit multi-pages (export CSV-ready)", input: { domain: "string", urls: "string[]?" } },
  { id: "semantic_audit",       status: "stable",  fn: "cocoon-diag-semantic",         desc: "Audit sémantique (champ lexical, entités, alignement intention)", input: { url: "string", keyword: "string?" } },
  { id: "cocoon",               status: "stable",  fn: "calculate-cocoon-logic",       desc: "Génération du cocon sémantique 3D (clusters, cannibalisation)", input: { domain: "string" } },
  { id: "content_architect",    status: "stable",  fn: "content-architecture-advisor", desc: "Recommandation éditoriale (4-étages : brief, stratège, rédacteur, tonalisateur)", input: { domain: "string", topic: "string", target_audience: "string?" } },
  { id: "autopilot_status",     status: "stable",  fn: "__autopilot_status",           desc: "Lecture du statut Autopilot (Périclès) pour un domaine", input: { domain: "string" } },
  { id: "conversion_optimizer", status: "preview", fn: null,                           desc: "Audit conversion (CTA, friction, GA4 behavioral metrics)", input: { url: "string" } },
  { id: "social_hub",           status: "stable",  fn: "generate-social-content",      desc: "Génération de variations sociales depuis un article", input: { url: "string", platforms: "string[]?" } },
  { id: "geo_score",            status: "stable",  fn: "check-geo",                    desc: "Score GEO (Generative Engine Optimization)", input: { url: "string" } },
  { id: "llm_visibility",       status: "stable",  fn: "calculate-llm-visibility",     desc: "Visibilité d'une marque dans les réponses LLM (ChatGPT, Perplexity, Gemini)", input: { brand: "string", queries: "string[]" } },
  { id: "ai_bots_analysis",     status: "stable",  fn: "geo-attribution-summary",      desc: "Analyse des hits bots IA (GPTBot, ClaudeBot, PerplexityBot, …) sur 30j", input: { domain: "string" } },
  { id: "observatory",          status: "stable",  fn: "aggregate-observatory",        desc: "Benchmarks sectoriels (positions moyennes, mix bots, IAS)", input: { sector: "string" } },
  { id: "serp_ranking",         status: "stable",  fn: "serp-benchmark",               desc: "Positions SERP multi-providers (DataForSEO + SerpAPI + Serper)", input: { keyword: "string", domain: "string?", location: "string?" } },
  { id: "competitors",          status: "stable",  fn: "audit-competitor-url",         desc: "Audit concurrentiel (SEO + GEO + SERP delta) sur 1-3 URLs", input: { domain: "string", competitors: "string[]" } },
];

const FEATURE_MAP = new Map(FEATURES.map(f => [f.id, f]));

// HMAC SHA-256 signature header — "sha256=<hex>"
async function hmacSign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

async function dispatchWebhooks(admin: any, userId: string, event: string, payload: any) {
  const { data: hooks } = await admin
    .from("developer_webhooks")
    .select("id, url, secret, events")
    .eq("user_id", userId)
    .eq("api", "crawlers")
    .eq("active", true);
  if (!hooks || hooks.length === 0) return;

  const body = JSON.stringify({ event, api: "crawlers", data: payload, sent_at: new Date().toISOString() });
  await Promise.all(hooks
    .filter((h: any) => Array.isArray(h.events) && h.events.includes(event))
    .map(async (h: any) => {
      const sig = await hmacSign(h.secret, body);
      let status = 0, responseBody = "", err: string | null = null;
      try {
        const r = await fetch(h.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Crawlers-Event": event,
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
        webhook_id: h.id, user_id: userId, event, payload: JSON.parse(body),
        attempts: 1,
        status: status >= 200 && status < 300 ? "delivered" : "failed",
        response_status: status || null, response_body: responseBody || null, error: err,
        delivered_at: status >= 200 && status < 300 ? new Date().toISOString() : null,
      });
      await admin.from("developer_webhooks")
        .update({ last_ping_at: new Date().toISOString(), last_status: status || null })
        .eq("id", h.id);
    }));
}
const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

// Rattache les tokens LLM consommés pendant le job (juge unique en base : chaque ligne de
// coût n'est réclamée qu'une fois, donc pas de double comptage entre jobs concurrents).
async function attributeTokens(admin: any, jobId: string, fn: string | null, since: string) {
  if (!fn || fn.startsWith("__")) return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const { data, error } = await admin.rpc("attribute_ai_tokens", {
    _job_id: jobId,
    _edge_function: fn,
    _since: since,
  });
  if (error) {
    console.error("[crawlers-api] token attribution failed", error.message);
    return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  }
  return data ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
}

// Contexte de facturation transmis au runner pour permettre le remboursement sur échec.
type BillingRef = {
  viaJwt: boolean;
  idemKey: string;
  costCents: number;
  billedSource: string;
};

// Rembourse ce qui a été débité avant l'exécution quand le job échoue.
// Un job qui n'a rien produit ne doit rien coûter : même juge à l'aller (mcp_authorize_call
// ou dev_wallet_debit) et au retour (mcp_refund_call ou dev_wallet_credit).
async function refundJob(admin: any, userId: string, billing: BillingRef | undefined, jobId: string, reason: string) {
  if (!billing) return null;
  try {
    if (billing.viaJwt) {
      const { data, error } = await admin.rpc("mcp_refund_call", {
        _user_id: userId,
        _idempotency_key: billing.idemKey,
        _reason: reason,
      });
      if (error) throw new Error(error.message);
      console.log(`[crawlers-api] refund mcp job=${jobId}`, data);
      return data;
    }
    if (billing.costCents > 0) {
      const { error } = await admin.rpc("dev_wallet_credit", {
        _user_id: userId,
        _amount_cents: billing.costCents,
        _source: "refund",
        _source_ref: `refund:${jobId}`,
        _description: `Remboursement job échoué (${reason})`,
      });
      if (error) throw new Error(error.message);
      console.log(`[crawlers-api] refund legacy job=${jobId} +${billing.costCents}c`);
      return { refunded: true, cost_cents: billing.costCents };
    }
    return { refunded: false, reason: "nothing_billed" };
  } catch (e) {
    console.error(`[crawlers-api] refund failed job=${jobId}`, e);
    return { refunded: false, reason: (e as Error).message };
  }
}

// Exécute une feature en background et met à jour le job en DB.

async function runFeature(admin: any, jobId: string, userId: string, feature: string, input: any, billing?: BillingRef) {
  const f = FEATURE_MAP.get(feature);
  const startedAt = new Date().toISOString();
  try {

    await admin.from("crawlers_api_jobs")
      .update({ status: "running", started_at: startedAt })
      .eq("id", jobId);

    if (!f?.fn) {
      throw new Error(`feature "${feature}" not yet wired (status=${f?.status ?? "unknown"})`);
    }

    let result: any;

    if (f.fn === "__autopilot_status") {
      const domain = String(input?.domain || "");
      if (!domain) throw new Error("missing field: domain");
      const { data, error } = await admin
        .from("pericles_targets")
        .select("domain, status, last_cycle_at, next_cycle_at, paused_reason")
        .eq("user_id", userId)
        .eq("domain", domain)
        .maybeSingle();
      if (error) throw new Error(error.message);
      result = data || { domain, status: "not_configured" };
    } else {
      const { data, error } = await admin.functions.invoke(f.fn, {
        body: { ...input, user_id: userId, _called_from: "crawlers-api", _job_id: jobId },
      });
      if (error) throw new Error(error.message || String(error));
      result = data;
    }

    await admin.from("crawlers_api_jobs")
      .update({ status: "completed", result, completed_at: new Date().toISOString() })
      .eq("id", jobId);

    const tokens = await attributeTokens(admin, jobId, f.fn, startedAt);

    await dispatchWebhooks(admin, userId, "job.completed", {
      id: jobId, feature, status: "completed", result, tokens,
    }).catch(e => console.error("[crawlers-api] webhook dispatch failed", e));

  } catch (e) {
    console.error(`[crawlers-api] feature ${feature} failed`, e);
    const refund = await refundJob(admin, userId, billing, jobId, (e as Error).message.slice(0, 120));

    await admin.from("crawlers_api_jobs")
      .update({
        status: "failed",
        error: { message: (e as Error).message, refund },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await attributeTokens(admin, jobId, f?.fn ?? null, startedAt);

    await dispatchWebhooks(admin, userId, "job.failed", {
      id: jobId, feature, status: "failed", error: (e as Error).message, refund,
    }).catch(err => console.error("[crawlers-api] webhook dispatch failed", err));



  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const headerKey = req.headers.get("x-crawlers-key");
  const token = headerKey || (auth.startsWith("Bearer ") ? auth.slice(7) : null);
  if (!token) return { error: "missing_api_key" };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Façade MCP : le jeton est un JWT utilisateur Supabase (OAuth 2.1), pas une clé crw_live_.
  // La facturation passe alors par mcp_authorize_call et non par le débit legacy de 10 centimes.
  if (req.headers.get("x-crawlers-auth") === "jwt") {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return { error: "invalid_token" };
    return {
      userId: userData.user.id,
      keyId: null as string | null,
      scopes: ["mcp"],
      admin,
      viaJwt: true,
      mcpTool: req.headers.get("x-mcp-tool"),
      mcpKey: req.headers.get("x-mcp-idempotency-key"),
    };
  }

  const { data, error } = await admin.rpc("crawlers_api_verify_token", { _token: token });
  if (error || !data || data.length === 0) return { error: "invalid_api_key" };

  return { userId: data[0].user_id, keyId: data[0].key_id, scopes: data[0].scopes, admin, viaJwt: false };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Normalise : on garde tout ce qui commence à /v1/ ou /health/ peu importe le préfixe (functions/v1/crawlers-api ou direct)
  const rawPath = url.pathname;
  const v1Idx = rawPath.indexOf("/v1/");
  let path: string;
  if (v1Idx >= 0) path = rawPath.slice(v1Idx).replace(/\/+$/, "") || "/";
  else if (rawPath.endsWith("/v1")) path = "/v1";
  else if (rawPath.includes("/health")) path = "/health";
  else path = "/";

  try {
    // Public — pas d'auth
    if (req.method === "GET" && (path === "/v1/features" || path === "/v1/features/")) {
      return json(200, { object: "list", data: FEATURES });
    }

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return json(200, { ok: true, service: "crawlers-api", version: "1.0.0", docs: "/docs/api/crawlers" });
    }

    // Auth
    const ctx = await authenticate(req);
    if ("error" in ctx) return json(401, { error: ctx.error, docs: "/docs/api/crawlers#authentication" });

    // POST /v1/jobs — créer un job (débit wallet 0,10 €)
    if (req.method === "POST" && path === "/v1/jobs") {
      let body: any;
      try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
      const feature = String(body?.feature || "").trim();
      const input = body?.input ?? {};
      if (!feature) return json(400, { error: "missing_field", field: "feature" });
      if (!FEATURE_IDS.has(feature)) {
        return json(400, { error: "unknown_feature", feature, see: "/v1/features" });
      }
      if (typeof input !== "object" || Array.isArray(input)) {
        return json(400, { error: "invalid_input", expected: "object" });
      }

      // Création préalable du job pour avoir un id pour la trace de débit
      const { data: job, error } = await ctx.admin
        .from("crawlers_api_jobs")
        .insert({ user_id: ctx.userId, api_key_id: ctx.keyId, feature, input })
        .select("id, feature, status, created_at")
        .single();
      if (error) return json(500, { error: "db_error", detail: error.message });

      // Facturation. Via MCP (JWT) : juge unique mcp_authorize_call (plan → wallet, plafond
      // journalier, idempotence). Via clé crw_live_ : débit legacy de 10 centimes.
      let costCents = 10;
      let billedSource = "wallet";
      let billingRef: BillingRef;
      if ((ctx as any).viaJwt) {
        const tool = (ctx as any).mcpTool || `start_${feature}`;
        const idemKey = (ctx as any).mcpKey || job.id;
        const { data: verdict, error: authErr } = await ctx.admin.rpc("mcp_authorize_call", {
          _user_id: ctx.userId,
          _tool_name: tool,
          _idempotency_key: idemKey,
          _client_id: null,
          _metadata: { job_id: job.id, feature },
        });
        const v = (verdict ?? {}) as Record<string, any>;
        if (authErr || !v.allowed) {
          await ctx.admin.from("crawlers_api_jobs")
            .update({ status: "failed", error: { message: v.reason ?? authErr?.message ?? "billing_refused" }, completed_at: new Date().toISOString() })
            .eq("id", job.id);
          return json(v.reason === "insufficient_balance" ? 402 : 403, {
            error: v.reason ?? "billing_refused",
            detail: authErr?.message ?? null,
            topup_url: v.topup_url ?? null,
            job_id: job.id,
          });
        }
        costCents = Math.round(Number(v.cost_micro ?? 0) / 10);
        billedSource = String(v.billed_source ?? "free");
        billingRef = { viaJwt: true, idemKey, costCents, billedSource };
      } else {
        const { error: debitErr } = await ctx.admin.rpc("dev_wallet_debit", {
          _user_id: ctx.userId,
          _amount_cents: 10,
          _source_ref: job.id,
          _description: `Job ${feature}`,
        });
        if (debitErr) {
          await ctx.admin.from("crawlers_api_jobs")
            .update({ status: "failed", error: { message: "insufficient_balance" }, completed_at: new Date().toISOString() })
            .eq("id", job.id);
          return json(402, {
            error: "insufficient_balance",
            message: "Recharge ton wallet sur /developers/profil?tab=facturation",
            job_id: job.id,
          });
        }
        billingRef = { viaJwt: false, idemKey: job.id, costCents: 10, billedSource: "wallet" };
      }

      // Exécution background — le client poll /v1/jobs/{id}
      // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
      EdgeRuntime.waitUntil(runFeature(ctx.admin, job.id, ctx.userId, feature, input, billingRef));


      return new Response(JSON.stringify({
        id: job.id,
        feature: job.feature,
        status: job.status,
        created_at: job.created_at,
        cost_cents: costCents,
        billed_source: billedSource,
        poll_url: `/v1/jobs/${job.id}`,
      }), {
        status: 202,

        headers: { ...corsHeaders, "Content-Type": "application/json", "Location": `/v1/jobs/${job.id}` },
      });
    }

    // GET /v1/jobs/{id}
    const jobMatch = path.match(/^\/v1\/jobs\/([0-9a-f-]{36})$/);
    if (req.method === "GET" && jobMatch) {
      const id = jobMatch[1];
      const { data: job, error } = await ctx.admin
        .from("crawlers_api_jobs")
        .select("id, feature, status, input, result, error, created_at, started_at, completed_at, input_tokens, output_tokens, total_tokens")
        .eq("id", id)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (error) return json(500, { error: "db_error", detail: error.message });
      if (!job) return json(404, { error: "job_not_found" });
      return json(200, job);
    }

    // POST /v1/jobs/{id}/cancel
    const cancelMatch = path.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const id = cancelMatch[1];
      const { data, error } = await ctx.admin
        .from("crawlers_api_jobs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", ctx.userId)
        .in("status", ["queued", "running"])
        .select("id, status")
        .maybeSingle();
      if (error) return json(500, { error: "db_error", detail: error.message });
      if (!data) return json(409, { error: "not_cancellable" });
      return json(200, data);
    }

    // GET /v1/jobs?limit=20 — lister
    if (req.method === "GET" && path === "/v1/jobs") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
      const { data, error } = await ctx.admin
        .from("crawlers_api_jobs")
        .select("id, feature, status, created_at, completed_at, input_tokens, output_tokens, total_tokens")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json(500, { error: "db_error", detail: error.message });
      return json(200, { object: "list", data });
    }

    // GET /v1/wallet/balance — solde wallet + estimation jobs restants
    if (req.method === "GET" && path === "/v1/wallet/balance") {
      const { data, error } = await ctx.admin
        .from("dev_wallets")
        .select("balance_cents, currency, updated_at")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (error) return json(500, { error: "db_error", detail: error.message });
      const balance_cents = data?.balance_cents ?? 0;
      return json(200, {
        balance_cents,
        currency: data?.currency ?? "EUR",
        estimated_jobs_remaining: Math.floor(balance_cents / 10),
        updated_at: data?.updated_at ?? new Date().toISOString(),
      });
    }

    return json(404, { error: "not_found", path });
  } catch (e) {
    console.error("[crawlers-api] error", e);
    return json(500, { error: "internal_error", message: (e as Error).message });
  }
});
