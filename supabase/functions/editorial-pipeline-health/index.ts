// ============================================================================
// EDITORIAL PIPELINE HEALTH CHECK
// ----------------------------------------------------------------------------
// Cron-friendly endpoint that scans recent pipeline logs and emits alerts
// when cost or latency cross adaptive thresholds.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "@supabase/supabase-js/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Thresholds (per single run, all stages combined)
const COST_THRESHOLD_USD = 0.50;       // alert if a single run > 50¢
const LATENCY_THRESHOLD_MS = 60_000;   // alert if a single run > 60s
const ERROR_RATE_THRESHOLD = 0.20;     // alert if >20% errors over window
const WINDOW_HOURS = 1;

interface LogRow {
  pipeline_run_id: string;
  user_id: string;
  domain: string;
  stage: string;
  latency_ms: number | null;
  cost_usd: number | null;
  status: string;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

    const { data: logs, error } = await supabase
      .from("editorial_pipeline_logs")
      .select("pipeline_run_id, user_id, domain, stage, latency_ms, cost_usd, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) throw error;

    const rows = (logs ?? []) as LogRow[];

    // Aggregate by run
    const byRun = new Map<string, {
      user_id: string;
      domain: string;
      total_cost: number;
      total_latency: number;
      stages: number;
      errors: number;
    }>();

    for (const r of rows) {
      const k = r.pipeline_run_id;
      if (!byRun.has(k)) {
        byRun.set(k, {
          user_id: r.user_id,
          domain: r.domain,
          total_cost: 0,
          total_latency: 0,
          stages: 0,
          errors: 0,
        });
      }
      const agg = byRun.get(k)!;
      agg.total_cost += Number(r.cost_usd ?? 0);
      agg.total_latency += Number(r.latency_ms ?? 0);
      agg.stages += 1;
      if (r.status !== "success") agg.errors += 1;
    }

    const alerts: Array<Record<string, unknown>> = [];

    for (const [run_id, agg] of byRun.entries()) {
      // Cost spike
      if (agg.total_cost > COST_THRESHOLD_USD) {
        alerts.push({
          user_id: agg.user_id,
          domain: agg.domain,
          alert_type: "cost_spike",
          severity: agg.total_cost > COST_THRESHOLD_USD * 2 ? "critical" : "warning",
          threshold_value: COST_THRESHOLD_USD,
          observed_value: Number(agg.total_cost.toFixed(4)),
          message: `Run ${run_id.slice(0, 8)} a coûté $${agg.total_cost.toFixed(3)} (seuil $${COST_THRESHOLD_USD})`,
          pipeline_run_id: run_id,
        });
      }
      // Latency spike
      if (agg.total_latency > LATENCY_THRESHOLD_MS) {
        alerts.push({
          user_id: agg.user_id,
          domain: agg.domain,
          alert_type: "latency_spike",
          severity: agg.total_latency > LATENCY_THRESHOLD_MS * 2 ? "critical" : "warning",
          threshold_value: LATENCY_THRESHOLD_MS,
          observed_value: agg.total_latency,
          message: `Run ${run_id.slice(0, 8)} a duré ${(agg.total_latency / 1000).toFixed(1)}s (seuil ${LATENCY_THRESHOLD_MS / 1000}s)`,
          pipeline_run_id: run_id,
        });
      }
    }

    // Domain-level error rate
    const byDomain = new Map<string, { user_id: string; total: number; errors: number }>();
    for (const r of rows) {
      const k = `${r.user_id}::${r.domain}`;
      if (!byDomain.has(k)) byDomain.set(k, { user_id: r.user_id, total: 0, errors: 0 });
      const d = byDomain.get(k)!;
      d.total += 1;
      if (r.status !== "success") d.errors += 1;
    }
    for (const [k, d] of byDomain.entries()) {
      if (d.total < 5) continue;
      const rate = d.errors / d.total;
      if (rate > ERROR_RATE_THRESHOLD) {
        const domain = k.split("::")[1];
        alerts.push({
          user_id: d.user_id,
          domain,
          alert_type: "error_rate",
          severity: rate > 0.5 ? "critical" : "warning",
          threshold_value: ERROR_RATE_THRESHOLD,
          observed_value: Number(rate.toFixed(3)),
          message: `Taux d'erreur ${(rate * 100).toFixed(0)}% sur ${d.total} stages dernière heure`,
        });
      }
    }

    // Dedup: skip alerts already raised in last hour for same (user, domain, type)
    const fresh: Array<Record<string, unknown>> = [];
    for (const a of alerts) {
      const { data: existing } = await supabase
        .from("editorial_pipeline_alerts")
        .select("id")
        .eq("user_id", a.user_id)
        .eq("domain", a.domain)
        .eq("alert_type", a.alert_type)
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();
      if (!existing) fresh.push(a);
    }

    if (fresh.length > 0) {
      await supabase.from("editorial_pipeline_alerts").insert(fresh);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        runs_analyzed: byRun.size,
        domains_analyzed: byDomain.size,
        alerts_raised: fresh.length,
        window_hours: WINDOW_HOURS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[pipeline-health] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
