/**
 * geo-attribution-summary
 * -----------------------
 * Renvoie l'agrégation 30j des attributions IA pour un tracked_site :
 *  - total visites attribuées
 *  - répartition par source IA (chatgpt / claude / perplexity…)
 *  - top URLs attribuées
 *  - timeline quotidienne
 *
 * Utilisé par la carte AIAttributionCard de la Console > GEO.
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { getServiceClient } from "../_shared/supabaseClient.ts";

interface AttribRow {
  ai_source: string;
  url: string;
  path: string;
  visited_at: string;
  attributed_count: number | null;
  top_attributed_bot: string | null;
  country: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const url = new URL(req.url);
    const trackedSiteId = url.searchParams.get("tracked_site_id");
    const days = Number(url.searchParams.get("days") ?? "30");
    if (!trackedSiteId) {
      return new Response(JSON.stringify({ error: "tracked_site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier ownership
    const { data: site } = await supabase
      .from("tracked_sites")
      .select("id, domain, user_id")
      .eq("id", trackedSiteId)
      .maybeSingle();
    if (!site || site.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const { data, error } = await supabase
      .from("ai_attribution_events")
      .select("ai_source, url, path, visited_at, attributed_count, top_attributed_bot, country")
      .eq("tracked_site_id", trackedSiteId)
      .gte("visited_at", since)
      .order("visited_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const rows = (data ?? []) as AttribRow[];
    const total = rows.length;

    // Par source
    const bySource = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.ai_source] = (acc[r.ai_source] ?? 0) + 1;
      return acc;
    }, {});

    // Top URLs
    const byUrl = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.path] = (acc[r.path] ?? 0) + 1;
      return acc;
    }, {});
    const topUrls = Object.entries(byUrl)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Timeline daily
    const byDay = rows.reduce<Record<string, number>>((acc, r) => {
      const day = r.visited_at.slice(0, 10);
      acc[day] = (acc[day] ?? 0) + 1;
      return acc;
    }, {});
    const timeline = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return new Response(
      JSON.stringify({
        ok: true,
        domain: site.domain,
        window_days: days,
        total,
        by_source: bySource,
        top_urls: topUrls,
        timeline,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[geo-attribution-summary] fatal", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
