import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from "../_shared/cors.ts";
import { checkIpRate, getClientIp, rateLimitResponse } from "../_shared/ipRateLimiter.ts";
import { trackEdgeFunctionError } from "../_shared/tokenTracker.ts";
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: calculate-internal-pagerank
 *
 * Computes PageRank on the internal link graph derived from crawl_pages.
 * Updates semantic_nodes.page_authority with the computed scores.
 *
 * Algorithm: Iterative PageRank with damping factor 0.85
 * - Deterministic, no LLM, pure linear algebra
 * - Identifies under-linked high-potential pages
 *
 * Access: Pro Agency / Admin only (same as Cocoon)
 */

const DAMPING = 0.85;
const MAX_ITERATIONS = 50;
const CONVERGENCE_THRESHOLD = 1e-6;

interface LinkEdge {
  from_url: string;
  to_url: string;
}

/**
 * Iterative PageRank computation
 * Returns a Map<url, pagerank_score> normalized to 0-100
 */
function computePageRank(
  urls: string[],
  edges: LinkEdge[],
): Map<string, number> {
  const n = urls.length;
  if (n === 0) return new Map();

  const urlIndex = new Map<string, number>();
  urls.forEach((u, i) => urlIndex.set(u, i));

  // Build adjacency: outLinks[i] = list of indices that page i links to
  const outLinks: number[][] = Array.from({ length: n }, () => []);
  const inLinks: number[][] = Array.from({ length: n }, () => []);

  for (const edge of edges) {
    const fromIdx = urlIndex.get(edge.from_url);
    const toIdx = urlIndex.get(edge.to_url);
    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      outLinks[fromIdx].push(toIdx);
      inLinks[toIdx].push(fromIdx);
    }
  }

  // Initialize uniform PageRank
  let pr = new Float64Array(n).fill(1 / n);
  let newPr = new Float64Array(n);

  // Iterative computation
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Sum of PR from dangling nodes (no outlinks)
    let danglingSum = 0;
    for (let i = 0; i < n; i++) {
      if (outLinks[i].length === 0) danglingSum += pr[i];
    }

    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      let inSum = 0;
      for (const j of inLinks[i]) {
        inSum += pr[j] / outLinks[j].length;
      }
      newPr[i] = (1 - DAMPING) / n + DAMPING * (inSum + danglingSum / n);
      maxDelta = Math.max(maxDelta, Math.abs(newPr[i] - pr[i]));
    }

    // Swap
    [pr, newPr] = [newPr, pr];

    if (maxDelta < CONVERGENCE_THRESHOLD) {
      console.log(`[PageRank] Converged at iteration ${iter + 1}`);
      break;
    }
  }

  // Normalize to 0-100 scale
  let maxPr = 0;
  for (let i = 0; i < n; i++) {
    if (pr[i] > maxPr) maxPr = pr[i];
  }

  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const score = maxPr > 0 ? Math.round((pr[i] / maxPr) * 100 * 100) / 100 : 0;
    result.set(urls[i], score);
  }

  return result;
}

Deno.serve(handleRequest(async (req) => {
const ip = getClientIp(req);
  const rateCheck = checkIpRate(ip, "calculate-internal-pagerank", 5, 60_000);
  if (!rateCheck.allowed) return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);

  try {
    const { tracked_site_id } = await req.json();
    if (!tracked_site_id) {
      return jsonError("tracked_site_id requis", 400);
    }
    const supabase = getServiceClient();

    // ─── Auth ───
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }
    if (!userId) {
      return jsonError("Non autorisé", 401);
    }

    // ─── Plan check ───
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("plan_type").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    if (!isAdmin && !["agency_pro", "agency_premium"].includes(profile?.plan_type || "")) {
      return jsonError("Accès réservé Pro Agency", 403);
    }

    // ─── Verify site ownership ───
    const { data: site } = await supabase
      .from("tracked_sites").select("id, domain, user_id")
      .eq("id", tracked_site_id).maybeSingle();

    if (!site || (site.user_id !== userId && !isAdmin)) {
      return jsonError("Site non trouvé", 404);
    }

    // ─── Get latest crawl ───
    const { data: crawls } = await supabase
      .from("site_crawls" as any).select("id")
      .eq("domain", site.domain).eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1);

    const latestCrawlId = crawls?.[0]?.id;
    if (!latestCrawlId) {
      return new Response(
        JSON.stringify({ error: "Aucun crawl trouvé. Lancez d'abord un crawl." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Fetch crawl pages with anchor texts (internal links) ───
    const { data: crawlPages } = await supabase
      .from("crawl_pages")
      .select("url, anchor_texts, internal_links")
      .eq("crawl_id", latestCrawlId)
      .limit(500);

    if (!crawlPages?.length) {
      return new Response(
        JSON.stringify({ error: "Aucune page crawlée trouvée." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Build link graph ───
    const allUrls = new Set(crawlPages.map((p: any) => p.url));
    const edges: LinkEdge[] = [];

    for (const page of crawlPages) {
      const anchors = page.anchor_texts as any[] || [];
      for (const anchor of anchors) {
        const targetUrl = anchor?.href || anchor?.url || anchor;
        if (typeof targetUrl === "string" && allUrls.has(targetUrl)) {
          edges.push({ from_url: page.url, to_url: targetUrl });
        }
      }
    }

    console.log(`[PageRank] ${allUrls.size} pages, ${edges.length} internal edges`);

    // ─── Compute PageRank ───
    const startTime = Date.now();
    const prScores = computePageRank([...allUrls], edges);
    const durationMs = Date.now() - startTime;

    console.log(`[PageRank] Computed in ${durationMs}ms`);

    // ─── Compute inbound link counts ───
    const inboundCounts = new Map<string, number>();
    for (const edge of edges) {
      inboundCounts.set(edge.to_url, (inboundCounts.get(edge.to_url) || 0) + 1);
    }

    // ─── Update semantic_nodes.page_authority + internal_links_in ───
    let updatedCount = 0;
    const updates: { url: string; page_authority: number; internal_links_in: number }[] = [];

    for (const [url, score] of prScores) {
      updates.push({
        url,
        page_authority: score,
        internal_links_in: inboundCounts.get(url) || 0,
      });
    }

    // Batch update via individual calls (semantic_nodes has unique constraint on tracked_site_id + url)
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      const promises = batch.map((u) =>
        supabase
          .from("semantic_nodes" as any)
          .update({ page_authority: u.page_authority, internal_links_in: u.internal_links_in })
          .eq("tracked_site_id", tracked_site_id)
          .eq("url", u.url)
      );
      const results = await Promise.all(promises);
      updatedCount += results.filter((r: any) => !r.error).length;
    }

    // ─── Stats ───
    const scores = [...prScores.values()].sort((a, b) => b - a);
    const topPages = [...prScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, score]) => ({
        url,
        pagerank: score,
        inbound_links: inboundCounts.get(url) || 0,
      }));

    // Identify under-linked high-potential pages (low PageRank but high traffic/ROI potential)
    // This will be enriched when connected to semantic_nodes data

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          pages_analyzed: allUrls.size,
          edges_count: edges.length,
          nodes_updated: updatedCount,
          computation_ms: durationMs,
          avg_pagerank: scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100
            : 0,
          median_pagerank: scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0,
          max_pagerank: scores[0] || 0,
        },
        top_pages: topPages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[PageRank] Error:", error);
    await trackEdgeFunctionError(
      "calculate-internal-pagerank",
      error instanceof Error ? error.message : String(error),
    ).catch(() => {});
    return jsonError("Erreur interne du calcul PageRank", 500);
  }
}));