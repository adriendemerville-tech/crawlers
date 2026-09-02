/**
 * geo-attribution-summary
 * -----------------------
 * Renvoie l'agrégation des attributions IA pour un tracked_site :
 *  - total visites attribuées
 *  - répartition par source IA
 *  - top URLs attribuées
 *  - timeline par moteur IA, agrégée par jour, semaine ou mois
 *
 * Utilisé par la Console > GEO.
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

type Interval = "day" | "week" | "month";

function getIsoWeekStart(value: Date): string {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function getBucketDate(value: string, interval: Interval): string {
  const date = new Date(value);
  if (interval === "week") return getIsoWeekStart(date);
  if (interval === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  return value.slice(0, 10);
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
    const requestedDays = Number(url.searchParams.get("days") ?? "30");
    const days = Number.isFinite(requestedDays) ? Math.min(730, Math.max(1, Math.round(requestedDays))) : 30;
    const requestedInterval = url.searchParams.get("interval");
    const interval: Interval = requestedInterval === "week" || requestedInterval === "month" ? requestedInterval : "day";

    if (!trackedSiteId) {
      return new Response(JSON.stringify({ error: "tracked_site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      .order("visited_at", { ascending: true })
      .limit(10000);
    if (error) throw error;

    const rows = (data ?? []) as AttribRow[];
    const total = rows.length;

    const bySource = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.ai_source] = (acc[row.ai_source] ?? 0) + 1;
      return acc;
    }, {});

    const byUrl = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.path] = (acc[row.path] ?? 0) + 1;
      return acc;
    }, {});
    const topUrls = Object.entries(byUrl)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const bySourceDay = rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
      const bucket = getBucketDate(row.visited_at, interval);
      acc[bucket] = acc[bucket] ?? {};
      acc[bucket][row.ai_source] = (acc[bucket][row.ai_source] ?? 0) + 1;
      return acc;
    }, {});
    const timelineBySource = Object.entries(bySourceDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, counts }));

    return new Response(
      JSON.stringify({
        ok: true,
        domain: site.domain,
        window_days: days,
        interval,
        total,
        by_source: bySource,
        top_urls: topUrls,
        timeline_by_source: timelineBySource,
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
