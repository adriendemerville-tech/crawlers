import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let action = "full";
  try {
    const body = await req.json().catch(() => ({}));
    action = body.action || "full";
  } catch { /* cron calls with no body */ }

  const results: Record<string, number> = {};

  // ── 1. Purge duplicates (same domain + user_id + normalized title, keep best) ──
  if (action === "full" || action === "purge_duplicates") {
    const { data: items } = await supabase
      .from("architect_workbench")
      .select("id, title, domain, user_id, spiral_score, manual_priority, status, created_at")
      .in("status", ["pending", "in_progress", "assigned"])
      .order("spiral_score", { ascending: false })
      .limit(1000);

    if (items && items.length > 0) {
      const seen = new Map<string, any>();
      const toDelete: string[] = [];

      for (const item of items) {
        const key = `${item.domain}::${item.user_id}::${(item.title || "").trim().toLowerCase()}`;
        if (seen.has(key)) {
          const existing = seen.get(key);
          // Keep the one with manual_priority or higher spiral_score
          if (item.manual_priority != null && existing.manual_priority == null) {
            toDelete.push(existing.id);
            seen.set(key, item);
          } else if ((item.spiral_score || 0) > (existing.spiral_score || 0) && existing.manual_priority == null) {
            toDelete.push(existing.id);
            seen.set(key, item);
          } else {
            toDelete.push(item.id);
          }
        } else {
          seen.set(key, item);
        }
      }

      if (toDelete.length > 0) {
        // Delete in batches of 50
        for (let i = 0; i < toDelete.length; i += 50) {
          const batch = toDelete.slice(i, i + 50);
          await supabase.from("architect_workbench").delete().in("id", batch);
        }
      }
      results.deleted = toDelete.length;
    } else {
      results.deleted = 0;
    }
  }

  // ── 2. Archive stale items (pending > 60 days, or validate_attempts > 3) ──
  if (action === "full" || action === "archive_stale") {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: stale } = await supabase
      .from("architect_workbench")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", sixtyDaysAgo)
      .limit(200);

    const { data: failedValidation } = await supabase
      .from("architect_workbench")
      .select("id")
      .in("status", ["pending", "in_progress"])
      .gt("validate_attempts", 3)
      .limit(100);

    const archiveIds = [
      ...(stale || []).map((s: any) => s.id),
      ...(failedValidation || []).map((s: any) => s.id),
    ];
    const uniqueIds = [...new Set(archiveIds)];

    if (uniqueIds.length > 0) {
      for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50);
        await supabase
          .from("architect_workbench")
          .update({ status: "done" } as any)
          .in("id", batch);
      }
    }
    results.archived = uniqueIds.length;
  }

  // ── 3. Recalc spiral_score for active items via score_spiral_priority ──
  if (action === "full" || action === "recalc_scores") {
    // Get distinct domain+user pairs
    const { data: pairs } = await supabase
      .from("architect_workbench")
      .select("domain, user_id")
      .in("status", ["pending", "in_progress", "assigned"])
      .limit(500);

    const uniquePairs = new Map<string, { domain: string; user_id: string }>();
    for (const p of (pairs || [])) {
      uniquePairs.set(`${p.domain}::${p.user_id}`, { domain: p.domain, user_id: p.user_id });
    }

    let updated = 0;
    for (const { domain, user_id } of uniquePairs.values()) {
      const { data: scored } = await supabase.rpc("score_spiral_priority", {
        p_domain: domain,
        p_user_id: user_id,
        p_limit: 100,
      });

      if (scored && scored.length > 0) {
        for (const item of scored) {
          await supabase
            .from("architect_workbench")
            .update({ spiral_score: item.spiral_score } as any)
            .eq("id", item.item_id);
          updated++;
        }
      }
    }
    results.updated = updated;
  }

  // ── 4. Reset stuck in_progress items (> 2h) ──
  if (action === "full") {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from("architect_workbench")
      .select("id")
      .eq("status", "in_progress")
      .lt("updated_at", twoHoursAgo)
      .limit(50);

    if (stuck && stuck.length > 0) {
      await supabase
        .from("architect_workbench")
        .update({ status: "pending" } as any)
        .in("id", stuck.map((s: any) => s.id));
      results.reset_stuck = stuck.length;
    }
  }

  console.log("[workbench-hygiene]", action, results);

  return new Response(JSON.stringify({ success: true, action, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
