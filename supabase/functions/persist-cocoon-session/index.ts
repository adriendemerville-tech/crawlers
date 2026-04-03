import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from "../_shared/cors.ts";
import { checkIpRate, getClientIp, rateLimitResponse } from "../_shared/ipRateLimiter.ts";
import { logSilentError } from "../_shared/silentErrorLogger.ts";
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: persist-cocoon-session
 *
 * Saves a cocoon session snapshot to cocoon_sessions for future ML training.
 * Captures: graph topology, aggregated scores, intent distribution, chat history.
 *
 * Called after cocoon generation or chat interaction.
 * No frontend wiring — will be integrated later.
 */

Deno.serve(handleRequest(async (req) => {
const ip = getClientIp(req);
  const rateCheck = checkIpRate(ip, "persist-cocoon-session", 10, 60_000);
  if (!rateCheck.allowed) return rateLimitResponse(corsHeaders, rateCheck.retryAfterMs);

  try {
    const body = await req.json();
    const { tracked_site_id, session_id } = body;

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

    // ─── Verify site ownership ───
    const { data: site } = await supabase
      .from("tracked_sites").select("id, domain, user_id")
      .eq("id", tracked_site_id).maybeSingle();

    if (!site || site.user_id !== userId) {
      return jsonError("Site non trouvé", 404);
    }

    // ─── Fetch current semantic_nodes for this site ───
    const { data: nodes } = await supabase
      .from("semantic_nodes" as any)
      .select("id, url, title, intent, cluster_id, iab_score, geo_score, roi_predictive, traffic_estimate, citability_score, eeat_score, content_gap_score, cannibalization_risk, internal_links_in, internal_links_out, page_authority, similarity_edges, depth")
      .eq("tracked_site_id", tracked_site_id)
      .eq("user_id", userId)
      .limit(200);

    if (!nodes?.length) {
      return jsonError("Aucun nœud sémantique trouvé. Lancez d'abord le Cocoon.", 400);
    }

    // ─── Compute aggregated features ───
    const n = nodes.length;
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(sum(arr) / arr.length * 100) / 100 : 0;

    const geoScores = nodes.map((nd: any) => Number(nd.geo_score) || 0);
    const citabilityScores = nodes.map((nd: any) => Number(nd.citability_score) || 0);
    const eeatScores = nodes.map((nd: any) => Number(nd.eeat_score) || 0);
    const roiValues = nodes.map((nd: any) => Number(nd.roi_predictive) || 0);
    const trafficValues = nodes.map((nd: any) => Number(nd.traffic_estimate) || 0);
    const gapScores = nodes.map((nd: any) => Number(nd.content_gap_score) || 0);
    const canniScores = nodes.map((nd: any) => Number(nd.cannibalization_risk) || 0);

    // Intent distribution
    const intentDist: Record<string, number> = {};
    for (const nd of nodes as any[]) {
      intentDist[nd.intent] = (intentDist[nd.intent] || 0) + 1;
    }

    // Cluster summary
    const clusterMap: Record<string, any[]> = {};
    for (const nd of nodes as any[]) {
      const cid = nd.cluster_id || "unclustered";
      if (!clusterMap[cid]) clusterMap[cid] = [];
      clusterMap[cid].push(nd);
    }
    const clusterSummary: Record<string, any> = {};
    for (const [cid, members] of Object.entries(clusterMap)) {
      clusterSummary[cid] = {
        count: members.length,
        avg_geo: avg(members.map((m) => Number(m.geo_score) || 0)),
        avg_roi: avg(members.map((m) => Number(m.roi_predictive) || 0)),
        total_traffic: sum(members.map((m) => Number(m.traffic_estimate) || 0)),
        dominant_intent: Object.entries(
          members.reduce((acc: Record<string, number>, m: any) => {
            acc[m.intent] = (acc[m.intent] || 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || "informational",
      };
    }

    // Internal links density = total edges / (n * (n-1))
    const totalEdges = sum(nodes.map((nd: any) => (nd.similarity_edges || []).length));
    const maxEdges = n * (n - 1);
    const linksDensity = maxEdges > 0 ? Math.round(totalEdges / maxEdges * 10000) / 100 : 0;

    // Build lightweight snapshots (strip large fields for storage efficiency)
    const nodesSnapshot = nodes.map((nd: any) => ({
      id: nd.id,
      url: nd.url,
      title: nd.title,
      intent: nd.intent,
      cluster_id: nd.cluster_id,
      geo_score: nd.geo_score,
      roi_predictive: nd.roi_predictive,
      traffic_estimate: nd.traffic_estimate,
      page_authority: nd.page_authority,
      depth: nd.depth,
    }));

    const edgesSnapshot = nodes.flatMap((nd: any) =>
      (nd.similarity_edges || []).map((e: any) => ({
        source: nd.url,
        target: e.target_url,
        score: e.score,
        type: e.type,
      })),
    );

    // ─── Chat messages (if updating existing session) ───
    let chatMessages: any[] = body.chat_messages || [];
    let chatTurns = body.chat_turns || 0;

    // ─── Upsert session ───
    const sessionData = {
      user_id: userId,
      tracked_site_id,
      domain: site.domain,
      nodes_count: n,
      clusters_count: Object.keys(clusterSummary).length,
      nodes_snapshot: nodesSnapshot,
      edges_snapshot: edgesSnapshot,
      cluster_summary: clusterSummary,
      avg_geo_score: avg(geoScores),
      avg_citability_score: avg(citabilityScores),
      avg_eeat_score: avg(eeatScores),
      avg_roi_predictive: avg(roiValues),
      total_traffic_estimate: sum(trafficValues),
      avg_content_gap: avg(gapScores),
      avg_cannibalization_risk: avg(canniScores),
      internal_links_density: linksDensity,
      intent_distribution: intentDist,
      chat_messages: chatMessages,
      chat_turns: chatTurns,
      generation_duration_ms: body.generation_duration_ms || null,
      model_version: "v1",
    };

    let result;
    if (session_id) {
      // Update existing session (e.g., after chat interaction)
      const { data, error } = await supabase
        .from("cocoon_sessions")
        .update({
          chat_messages: chatMessages,
          chat_turns: chatTurns,
        })
        .eq("id", session_id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      result = data;
    } else {
      // Create new session
      const { data, error } = await supabase
        .from("cocoon_sessions")
        .insert(sessionData)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: result?.id,
        stats: {
          nodes_count: n,
          clusters_count: Object.keys(clusterSummary).length,
          edges_count: edgesSnapshot.length,
          avg_geo_score: avg(geoScores),
          avg_roi: avg(roiValues),
          links_density: linksDensity,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[PersistCocoonSession] Error:", error);
    await logSilentError("persist-cocoon-session", "persist-session", error, { severity: "high", impact: "data_loss" });
    return jsonError(error instanceof Error ? error.message : "Erreur interne", 500);
  }
}));