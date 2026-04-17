/**
 * cron-cocoon-refresh — Weekly automatic cocoon refresh
 * Runs every Sunday 02:00 UTC (pg_cron).
 *
 * For each tracked_site with weekly_refresh_enabled = true and
 * (last_cocoon_refresh_at IS NULL OR < now() - 7 days), invokes
 * calculate-cocoon-logic to recompute the cocoon graph.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 8 * 60 * 1000;
const PER_SITE_DELAY_MS = 1500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: sites, error } = await supabase
      .from("tracked_sites")
      .select("id, domain, user_id, last_cocoon_refresh_at")
      .eq("weekly_refresh_enabled", true)
      .or(`last_cocoon_refresh_at.is.null,last_cocoon_refresh_at.lt.${sevenDaysAgo}`)
      .limit(200);

    if (error) throw error;
    const sitesList = sites ?? [];

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;

    for (const site of sitesList) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[cron-cocoon-refresh] ⏱ Time budget reached, stopping at ${refreshed + failed}/${sitesList.length}`);
        break;
      }

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/calculate-cocoon-logic`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tracked_site_id: site.id, mode: "refresh" }),
        });

        if (resp.ok) {
          await supabase
            .from("tracked_sites")
            .update({ last_cocoon_refresh_at: new Date().toISOString() })
            .eq("id", site.id);
          refreshed++;
          console.log(`[cron-cocoon-refresh] ✅ ${site.domain}`);
        } else {
          failed++;
          console.warn(`[cron-cocoon-refresh] ⚠️ ${site.domain} HTTP ${resp.status}`);
        }
      } catch (err) {
        failed++;
        console.error(`[cron-cocoon-refresh] ❌ ${site.domain}:`, err);
      }

      await new Promise((r) => setTimeout(r, PER_SITE_DELAY_MS));
    }

    const summary = {
      total_candidates: sitesList.length,
      refreshed,
      skipped,
      failed,
      runtime_ms: Date.now() - startTime,
    };

    await supabase.from("analytics_events").insert({
      event_type: "cron_cocoon_refresh_completed",
      event_data: summary,
    }).catch(() => {});

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cron-cocoon-refresh] FATAL:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
