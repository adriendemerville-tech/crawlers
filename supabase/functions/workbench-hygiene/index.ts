import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Nombre max de constats actifs conservés par (domaine, utilisateur). */
const ACTIVE_CAP_PER_DOMAIN = 40;
/** Au-delà, les constats sont écartés (`dismissed`) — jamais supprimés. */
const ACTIVE_STATUSES = ["pending", "in_progress", "assigned"];

function normUrl(u: string | null): string {
  if (!u) return "";
  return u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^www\./, "");
}

function severityRank(s: string | null): number {
  return s === "critical" ? 3 : s === "high" ? 2 : s === "medium" ? 1 : 0;
}

/** Score de conservation : priorité manuelle > gravité > score spirale > fraîcheur. */
function keepScore(i: any): number {
  return (i.manual_priority != null ? 1_000_000 : 0)
    + severityRank(i.severity) * 10_000
    + (Number(i.spiral_score) || 0)
    + (i.status === "in_progress" ? 500 : 0);
}

async function updateInBatches(supabase: any, ids: string[], patch: Record<string, unknown>) {
  for (let i = 0; i < ids.length; i += 100) {
    await supabase.from("architect_workbench").update(patch as any).in("id", ids.slice(i, i + 100));
  }
}

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

  // ── 1. Déduplication : même domaine + user + (titre normalisé OU catégorie+URL cible) ──
  if (action === "full" || action === "purge_duplicates") {
    const { data: items } = await supabase
      .from("architect_workbench")
      .select("id, title, domain, user_id, spiral_score, manual_priority, status, severity, finding_category, target_url, created_at")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(3000);

    const toDelete: string[] = [];
    if (items && items.length > 0) {
      const seen = new Map<string, any>();

      for (const item of items) {
        const base = `${item.domain}::${item.user_id}`;
        // Deux signatures : le titre exact, et la paire (catégorie, URL cible).
        // Un doublon sur l'une ou l'autre suffit à écarter le constat.
        const keys = [
          `${base}::t::${(item.title || "").trim().toLowerCase().replace(/\s+/g, " ")}`,
          `${base}::c::${item.finding_category || ""}::${normUrl(item.target_url)}`,
        ];

        const rival = keys.map((k) => seen.get(k)).find(Boolean);
        if (rival) {
          const loser = keepScore(item) > keepScore(rival) ? rival : item;
          const winner = loser === rival ? item : rival;
          toDelete.push(loser.id);
          for (const k of keys) seen.set(k, winner);
        } else {
          for (const k of keys) seen.set(k, item);
        }
      }

      const uniqueDelete = [...new Set(toDelete)];
      for (let i = 0; i < uniqueDelete.length; i += 100) {
        await supabase.from("architect_workbench").delete().in("id", uniqueDelete.slice(i, i + 100));
      }
      results.deleted = uniqueDelete.length;
    } else {
      results.deleted = 0;
    }
  }

  // ── 2. Archivage : pending > 60 jours, ou plus de 3 échecs de validation ──
  if (action === "full" || action === "archive_stale") {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: stale } = await supabase
      .from("architect_workbench")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", sixtyDaysAgo)
      .limit(500);

    const { data: failedValidation } = await supabase
      .from("architect_workbench")
      .select("id")
      .in("status", ["pending", "in_progress"])
      .gt("validate_attempts", 3)
      .limit(200);

    const uniqueIds = [...new Set([
      ...(stale || []).map((s: any) => s.id),
      ...(failedValidation || []).map((s: any) => s.id),
    ])];

    if (uniqueIds.length > 0) {
      // `dismissed` et non `done` : rien n'a été exécuté, il ne faut pas le compter comme fait.
      await updateInBatches(supabase, uniqueIds, { status: "dismissed" });
    }
    results.archived = uniqueIds.length;
  }

  // ── 3. Plafond par domaine : garder les N meilleurs constats actifs, écarter le reste ──
  // Sans ce plafond la file grossit indéfiniment (Marina réécrit des centaines de
  // constats par lot multipages) et le scoring ne redescend jamais en exécution.
  if (action === "full" || action === "cap_backlog") {
    const { data: active } = await supabase
      .from("architect_workbench")
      .select("id, domain, user_id, status, severity, spiral_score, manual_priority, created_at")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(5000);

    const groups = new Map<string, any[]>();
    for (const item of (active || [])) {
      const k = `${item.domain}::${item.user_id}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(item);
    }

    const overflow: string[] = [];
    for (const list of groups.values()) {
      if (list.length <= ACTIVE_CAP_PER_DOMAIN) continue;
      list.sort((a, b) => keepScore(b) - keepScore(a));
      for (const item of list.slice(ACTIVE_CAP_PER_DOMAIN)) overflow.push(item.id);
    }

    if (overflow.length > 0) {
      await updateInBatches(supabase, overflow, { status: "dismissed" });
    }
    results.capped = overflow.length;
  }

  // ── 4. Recalcul du spiral_score pour les constats actifs restants ──
  if (action === "full" || action === "recalc_scores") {
    const { data: pairs } = await supabase
      .from("architect_workbench")
      .select("domain, user_id")
      .in("status", ACTIVE_STATUSES)
      .limit(2000);

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

      for (const item of (scored || [])) {
        await supabase
          .from("architect_workbench")
          .update({ spiral_score: item.spiral_score } as any)
          .eq("id", item.item_id);
        updated++;
      }
    }
    results.updated = updated;
  }

  // ── 5. Réinitialisation des constats bloqués en in_progress (> 2 h) ──
  if (action === "full" || action === "reset_stuck") {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from("architect_workbench")
      .select("id")
      .eq("status", "in_progress")
      .lt("updated_at", twoHoursAgo)
      .limit(500);

    if (stuck && stuck.length > 0) {
      await updateInBatches(supabase, stuck.map((s: any) => s.id), { status: "pending" });
    }
    results.reset_stuck = stuck?.length ?? 0;
  }

  // ── 6. Passe de priorité unifiée : dette de pruning par site + rescoring ROI ──
  // Elle passe en dernier : elle juge ce qui reste après déduplication et plafond,
  // et c'est le seul endroit qui voit le corpus entier (donc la cannibalisation).
  let priorityPass: unknown = null;
  if (action === "full" || action === "priority_pass") {
    try {
      const pass = await runPriorityPass(supabase, {
        domain: body?.domain ?? null,
        userId: body?.user_id ?? null,
        limit: Number(body?.limit) || 20,
      });
      results.priority_sites = pass.sites_processed;
      results.priority_items = pass.results.reduce((s, r) => s + r.scored, 0);
      results.creations_frozen = pass.results.reduce((s, r) => s + r.frozen, 0);
      priorityPass = pass.results.map((r) => ({
        domain: r.domain,
        debt: r.debt?.debt ?? null,
        regime: r.debt?.regime ?? null,
        corpus_size: r.debt?.corpus_size ?? null,
        useful_pages: r.debt?.useful_pages ?? null,
        cannibal_clusters: r.debt?.cannibal_clusters ?? null,
        explanation: r.debt?.explanation ?? null,
        items_scored: r.scored,
        creations_frozen: r.frozen,
      }));
    } catch (e) {
      console.error("[workbench-hygiene] priority_pass failed:", e instanceof Error ? e.message : e);
      results.priority_sites = 0;
    }
  }

  console.log("[workbench-hygiene]", action, results);

  return new Response(JSON.stringify({ success: true, action, ...results, priority_pass: priorityPass }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

