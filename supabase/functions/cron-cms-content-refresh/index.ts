/**
 * cron-cms-content-refresh — Weekly automatic CMS content cache refresh
 * Runs every Sunday 03:00 UTC (pg_cron).
 *
 * For each connected CMS (status = 'connected'), refreshes its content cache
 * via cms-content-stats / iktracker-actions / wpsync depending on platform.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 8 * 60 * 1000;
const PER_CMS_DELAY_MS = 2000;

// Read-only platforms — skip
const READ_ONLY_PLATFORMS = new Set(["wix", "webflow"]);

const PLATFORM_REFRESH_FN: Record<string, string> = {
  wordpress: "wpsync",
  iktracker: "iktracker-actions",
  shopify: "cms-content-stats",
  drupal: "cms-content-stats",
  prestashop: "cms-content-stats",
  odoo: "cms-content-stats",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: connections, error } = await supabase
      .from("cms_connections")
      .select("id, tracked_site_id, user_id, platform, site_url")
      .eq("status", "connected")
      .limit(300);

    if (error) throw error;
    const list = (connections ?? []).filter(
      (c) => !READ_ONLY_PLATFORMS.has((c.platform || "").toLowerCase()),
    );

    let refreshed = 0;
    let skipped = (connections?.length ?? 0) - list.length;
    let failed = 0;

    for (const conn of list) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[cron-cms-content-refresh] ⏱ Time budget reached`);
        break;
      }

      const fn = PLATFORM_REFRESH_FN[(conn.platform || "").toLowerCase()];
      if (!fn) {
        skipped++;
        continue;
      }

      try {
        const body =
          fn === "iktracker-actions"
            ? { action: "refresh_content_cache", tracked_site_id: conn.tracked_site_id }
            : fn === "wpsync"
            ? { action: "scan_content", tracked_site_id: conn.tracked_site_id }
            : { tracked_site_id: conn.tracked_site_id, mode: "refresh" };

        const resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (resp.ok) {
          await supabase
            .from("tracked_sites")
            .update({ last_cms_refresh_at: new Date().toISOString() })
            .eq("id", conn.tracked_site_id);
          refreshed++;
          console.log(`[cron-cms-content-refresh] ✅ ${conn.platform} ${conn.site_url}`);
        } else {
          failed++;
          console.warn(
            `[cron-cms-content-refresh] ⚠️ ${conn.platform} ${conn.site_url} HTTP ${resp.status}`,
          );
        }
      } catch (err) {
        failed++;
        console.error(`[cron-cms-content-refresh] ❌ ${conn.site_url}:`, err);
      }

      await new Promise((r) => setTimeout(r, PER_CMS_DELAY_MS));
    }

    const summary = {
      total_connections: connections?.length ?? 0,
      refreshed,
      skipped,
      failed,
      runtime_ms: Date.now() - startTime,
    };

    await supabase.from("analytics_events").insert({
      event_type: "cron_cms_refresh_completed",
      event_data: summary,
    }).catch(() => {});

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cron-cms-content-refresh] FATAL:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
