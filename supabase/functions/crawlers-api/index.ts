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
// Chaque entrée déclare son schéma d'input attendu (humain, pour la doc côté worker).
const FEATURES = [
  { id: "audit_expert",        status: "preview", desc: "Audit Expert 168 critères (technique + sémantique + EEAT)", input: { url: "string" } },
  { id: "machine_layer",       status: "preview", desc: "Machine Layer Scanner (lisibilité bots IA, JSON-LD, robots, sitemap)", input: { url: "string" } },
  { id: "eeat",                status: "preview", desc: "Score E-E-A-T détaillé (expertise, autorité, fiabilité)", input: { url: "string" } },
  { id: "site_crawl",          status: "preview", desc: "Crawl d'un site (BFS depth 3 max)", input: { domain: "string", depth: "number?", limit: "number?" } },
  { id: "pagespeed",           status: "preview", desc: "PageSpeed Insights (mobile + desktop) + Core Web Vitals", input: { url: "string" } },
  { id: "audit_matrix",        status: "preview", desc: "Matrice d'audit multi-pages (export CSV-ready)", input: { domain: "string", urls: "string[]?" } },
  { id: "semantic_audit",      status: "preview", desc: "Audit sémantique (champ lexical, entités, alignement intention)", input: { url: "string", keyword: "string?" } },
  { id: "cocoon",              status: "preview", desc: "Génération du cocon sémantique 3D (clusters, cannibalisation)", input: { domain: "string" } },
  { id: "content_architect",   status: "preview", desc: "Recommandation éditoriale (4-étages : brief, stratège, rédacteur, tonalisateur)", input: { domain: "string", topic: "string", target_audience: "string?" } },
  { id: "autopilot_status",    status: "preview", desc: "Lecture du statut Autopilot (Parménion) pour un domaine", input: { domain: "string" } },
  { id: "conversion_optimizer",status: "preview", desc: "Audit conversion (CTA, friction, GA4 behavioral metrics)", input: { url: "string" } },
  { id: "social_hub",          status: "preview", desc: "Génération de variations sociales depuis un article", input: { url: "string", platforms: "string[]?" } },
  { id: "geo_score",           status: "preview", desc: "Score GEO (Generative Engine Optimization)", input: { url: "string" } },
  { id: "llm_visibility",      status: "preview", desc: "Visibilité d'une marque dans les réponses LLM (ChatGPT, Perplexity, Gemini)", input: { brand: "string", queries: "string[]" } },
  { id: "ai_bots_analysis",    status: "preview", desc: "Analyse des hits bots IA (GPTBot, ClaudeBot, PerplexityBot, …) sur 30j", input: { domain: "string" } },
  { id: "observatory",         status: "preview", desc: "Benchmarks sectoriels (positions moyennes, mix bots, IAS)", input: { sector: "string" } },
  { id: "serp_ranking",        status: "preview", desc: "Positions SERP multi-providers (DataForSEO + SerpAPI + Serper)", input: { keyword: "string", domain: "string?", location: "string?" } },
  { id: "competitors",         status: "preview", desc: "Audit concurrentiel (SEO + GEO + SERP delta) sur 1-3 URLs", input: { domain: "string", competitors: "string[]" } },
];

const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

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
  const { data, error } = await admin.rpc("crawlers_api_verify_token", { _token: token });
  if (error || !data || data.length === 0) return { error: "invalid_api_key" };

  return { userId: data[0].user_id, keyId: data[0].key_id, scopes: data[0].scopes, admin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // path après /functions/v1/crawlers-api
  const path = url.pathname.replace(/^\/functions\/v1\/crawlers-api/, "").replace(/^\/+/, "/");

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

    // POST /v1/jobs — créer un job
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

      const { data: job, error } = await ctx.admin
        .from("crawlers_api_jobs")
        .insert({ user_id: ctx.userId, api_key_id: ctx.keyId, feature, input })
        .select("id, feature, status, created_at")
        .single();
      if (error) return json(500, { error: "db_error", detail: error.message });

      return new Response(JSON.stringify({
        id: job.id,
        feature: job.feature,
        status: job.status,
        created_at: job.created_at,
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
        .select("id, feature, status, input, result, error, created_at, started_at, completed_at")
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
        .select("id, feature, status, created_at, completed_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json(500, { error: "db_error", detail: error.message });
      return json(200, { object: "list", data });
    }

    return json(404, { error: "not_found", path });
  } catch (e) {
    console.error("[crawlers-api] error", e);
    return json(500, { error: "internal_error", message: (e as Error).message });
  }
});
