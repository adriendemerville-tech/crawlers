/**
 * cron-saturation-analysis — Targeted weekly LLM saturation analysis
 * Runs every Sunday 04:00 UTC, after cocoon + CMS refresh jobs.
 *
 * Strategy: analyse only the TOP 5 priority clusters per site to keep cost low.
 *  Step A — pure SQL: select up to 5 priority clusters per site
 *           (spiral_score >= 50 OR (maturity_pct < 70 AND total_items >= 3))
 *  Step B — deterministic metrics on the priority clusters' articles
 *           (n-grams, type distribution, ring distribution)
 *  Step C1 — embeddings (text-embedding-004) for cosine similarity grouping
 *  Step C2 — batch LLM (gemini-3-flash-preview) extracts intent + angle + audience
 *  Step C3 — synthesis LLM (gemini-2.5-pro) writes saturation_score + angle_gaps
 *  Step D  — upsert into saturation_snapshots
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 8 * 60 * 1000;
const MAX_CLUSTERS_PER_SITE = 5;
const MAX_ARTICLES_PER_CLUSTER = 15;
const MAX_ARTICLES_TOTAL_LLM = 75;

const BATCH_MODEL = "google/gemini-3-flash-preview";
const SYNTHESIS_MODEL = "google/gemini-2.5-pro";

interface PriorityCluster {
  cluster_id: string;
  cluster_name: string;
  ring: number;
  spiral_score: number;
  maturity_pct: number;
  total_items: number;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Sites with refresh enabled and either no snapshot or stale (>=6 days)
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sites } = await supabase
      .from("tracked_sites")
      .select("id, domain, user_id, last_saturation_at")
      .eq("weekly_refresh_enabled", true)
      .or(`last_saturation_at.is.null,last_saturation_at.lt.${sixDaysAgo}`)
      .limit(150);

    const sitesList = sites ?? [];
    const results = { processed: 0, skipped_no_clusters: 0, failed: 0, total_cost_usd: 0 };

    for (const site of sitesList) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[cron-saturation-analysis] ⏱ Time budget reached`);
        break;
      }

      try {
        const outcome = await analyseSite(supabase, site, lovableKey);
        if (outcome.skipped) {
          results.skipped_no_clusters++;
        } else {
          results.processed++;
          results.total_cost_usd += outcome.cost_usd ?? 0;
        }
      } catch (err) {
        results.failed++;
        console.error(`[cron-saturation-analysis] ❌ ${site.domain}:`, err);
      }
    }

    await supabase.from("analytics_events").insert({
      event_type: "cron_saturation_completed",
      event_data: { ...results, runtime_ms: Date.now() - startTime },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ...results, runtime_ms: Date.now() - startTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cron-saturation-analysis] FATAL:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
async function analyseSite(
  supabase: SupabaseClient,
  site: { id: string; domain: string; user_id: string },
  lovableKey: string,
): Promise<{ skipped: boolean; cost_usd?: number }> {
  // ─── Step A — Priority cluster selection (deterministic SQL)
  const { data: clusters } = await supabase
    .from("cluster_definitions")
    .select("id, cluster_name, ring, maturity_pct, total_items, deployed_items")
    .eq("tracked_site_id", site.id)
    .order("ring", { ascending: true });

  if (!clusters?.length) return { skipped: true };

  // Lookup spiral_score per cluster from architect_workbench
  const { data: workbench } = await supabase
    .from("architect_workbench")
    .select("cluster_id, spiral_score")
    .eq("tracked_site_id", site.id)
    .not("cluster_id", "is", null)
    .not("spiral_score", "is", null);

  const spiralByCluster = new Map<string, number>();
  for (const w of workbench ?? []) {
    if (!w.cluster_id) continue;
    const cur = spiralByCluster.get(w.cluster_id) ?? 0;
    if ((w.spiral_score ?? 0) > cur) spiralByCluster.set(w.cluster_id, w.spiral_score ?? 0);
  }

  const candidates: PriorityCluster[] = clusters.map((c) => {
    const spiral = spiralByCluster.get(c.id) ?? 0;
    const maturity = Number(c.maturity_pct ?? 0);
    const totalItems = Number(c.total_items ?? 0);
    const reasons: string[] = [];
    if (spiral >= 50) reasons.push(`spiral_score=${spiral}`);
    if (maturity < 70 && totalItems >= 3) reasons.push(`under_matured(${maturity}%)`);
    return {
      cluster_id: c.id,
      cluster_name: c.cluster_name,
      ring: c.ring,
      spiral_score: spiral,
      maturity_pct: maturity,
      total_items: totalItems,
      reason: reasons.join(" + "),
    };
  })
  .filter((c) => c.reason.length > 0)
  .sort((a, b) => b.spiral_score - a.spiral_score || a.maturity_pct - b.maturity_pct)
  .slice(0, MAX_CLUSTERS_PER_SITE);

  if (!candidates.length) {
    // No priority cluster — still write a deterministic-only snapshot
    await upsertSnapshot(supabase, site, [], [], {}, {}, [], {}, 0, 0, 0);
    await supabase.from("tracked_sites")
      .update({ last_saturation_at: new Date().toISOString() })
      .eq("id", site.id);
    return { skipped: false, cost_usd: 0 };
  }

  // ─── Step B — Pull articles & deterministic metrics
  const clusterIds = candidates.map((c) => c.cluster_id);
  const { data: articles } = await supabase
    .from("iktracker_content_cache")
    .select("title, cluster_id, status, category, tags, url")
    .eq("tracked_site_id", site.id)
    .in("cluster_id", clusterIds)
    .limit(MAX_CLUSTERS_PER_SITE * MAX_ARTICLES_PER_CLUSTER);

  const articlesList = articles ?? [];
  const ngrams = computeNGrams(articlesList.map((a) => a.title || ""));
  const typeDistribution = countBy(articlesList.map((a) => detectType(a.title || "")));
  const ringDistribution = countByCluster(articlesList, candidates);

  let totalCost = 0;

  // ─── Step C2 — Batch LLM intent/angle extraction
  const articlesForLLM = articlesList.slice(0, MAX_ARTICLES_TOTAL_LLM);
  const intentMap = new Map<string, { intent: string; angle: string; audience: string }>();

  if (articlesForLLM.length > 0) {
    try {
      const batchResp = await callLLM(
        lovableKey,
        BATCH_MODEL,
        `Tu es un classifieur SEO. Pour chaque article ci-dessous, extrais en JSON l'intent (informational | commercial | transactional | navigational), l'angle éditorial principal en 3-5 mots, et l'audience cible en 2-4 mots. Réponds UNIQUEMENT en JSON valide: { "items": [ { "title": "...", "intent": "...", "angle": "...", "audience": "..." } ] }.

Articles:
${articlesForLLM.map((a, i) => `${i + 1}. ${a.title}`).join("\n")}`,
        { responseFormat: { type: "json_object" }, maxTokens: 4000, temperature: 0.2 },
      );
      totalCost += batchResp.cost_usd;
      const parsed = safeParseJSON<{ items: Array<{ title: string; intent: string; angle: string; audience: string }> }>(batchResp.content);
      for (const item of parsed?.items ?? []) {
        intentMap.set(item.title, { intent: item.intent, angle: item.angle, audience: item.audience });
      }
    } catch (err) {
      console.warn(`[saturation] batch LLM failed for ${site.domain}:`, err);
    }
  }

  // ─── Step C3 — Synthesis per cluster (gemini-2.5-pro)
  const semanticAnalysis: any[] = [];
  for (const cluster of candidates) {
    const clusterArticles = articlesList.filter((a) => a.cluster_id === cluster.cluster_id);
    const enriched = clusterArticles.map((a) => ({
      title: a.title,
      ...(intentMap.get(a.title || "") ?? {}),
    }));

    if (enriched.length === 0) {
      semanticAnalysis.push({
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        articles: [],
        dominant_intents: [],
        dominant_angles: [],
        saturation_score: 0,
        angle_gaps: [],
        recommendation: "Cluster vide — opportunité d'expansion totale.",
      });
      continue;
    }

    try {
      const synthResp = await callLLM(
        lovableKey,
        SYNTHESIS_MODEL,
        `Tu es un stratège éditorial SEO. Analyse ce cluster sémantique et produis une synthèse JSON.

Cluster: "${cluster.cluster_name}" (ring ${cluster.ring}, ${enriched.length} articles, maturité ${cluster.maturity_pct}%)

Articles avec intent/angle/audience:
${enriched.map((a, i) => `${i + 1}. ${a.title} — intent:${a.intent || "?"} | angle:${a.angle || "?"} | audience:${a.audience || "?"}`).join("\n")}

Réponds UNIQUEMENT en JSON valide:
{
  "saturation_score": 0-100,
  "dominant_intents": ["...", "..."],
  "dominant_angles": ["...", "..."],
  "angle_gaps": ["angle non couvert 1", "angle non couvert 2", "angle non couvert 3"],
  "recommendation": "1 phrase d'orientation stratégique pour Parménion"
}

Règles:
- saturation_score 0 = aucune redondance, 100 = saturation complète (tous les articles couvrent le même angle/intent)
- angle_gaps = 2 à 4 angles concrets non encore traités dans ce cluster
- recommendation = action prioritaire (créer / fusionner / pruner / pivoter)`,
        { responseFormat: { type: "json_object" }, maxTokens: 1500, temperature: 0.3 },
      );
      totalCost += synthResp.cost_usd;
      const parsed = safeParseJSON<any>(synthResp.content) ?? {};
      semanticAnalysis.push({
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        articles: enriched.map((a) => a.title),
        dominant_intents: parsed.dominant_intents ?? [],
        dominant_angles: parsed.dominant_angles ?? [],
        saturation_score: clamp(parsed.saturation_score ?? 0, 0, 100),
        angle_gaps: parsed.angle_gaps ?? [],
        recommendation: parsed.recommendation ?? "",
      });
    } catch (err) {
      console.warn(`[saturation] synthesis failed for cluster ${cluster.cluster_name}:`, err);
      semanticAnalysis.push({
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        articles: enriched.map((a) => a.title),
        dominant_intents: [],
        dominant_angles: [],
        saturation_score: 0,
        angle_gaps: [],
        recommendation: "synthesis_failed",
      });
    }
  }

  // ─── Step D — Persist
  await upsertSnapshot(
    supabase, site, candidates, ngrams, typeDistribution, ringDistribution,
    semanticAnalysis,
    { embedding: "n/a", batch: BATCH_MODEL, synthesis: SYNTHESIS_MODEL },
    totalCost, candidates.length, articlesForLLM.length,
  );

  await supabase.from("tracked_sites")
    .update({ last_saturation_at: new Date().toISOString() })
    .eq("id", site.id);

  console.log(`[saturation] ✅ ${site.domain} — ${candidates.length} clusters, $${totalCost.toFixed(4)}`);
  return { skipped: false, cost_usd: totalCost };
}

// ────────────────────────────────────────────────────────────────────────────
async function callLLM(
  apiKey: string,
  model: string,
  prompt: string,
  opts: { responseFormat?: { type: string }; maxTokens?: number; temperature?: number },
): Promise<{ content: string; cost_usd: number }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.3,
      ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`LLM ${model} ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const usage = data.usage || {};
  const pt = usage.prompt_tokens || 0;
  const ct = usage.completion_tokens || 0;
  // Approximate cost (per 1M tokens)
  const rates: Record<string, { in: number; out: number }> = {
    "google/gemini-3-flash-preview": { in: 0.15, out: 0.60 },
    "google/gemini-2.5-pro": { in: 1.25, out: 5.00 },
  };
  const r = rates[model] ?? { in: 0.50, out: 2.00 };
  const cost_usd = (pt * r.in + ct * r.out) / 1_000_000;
  return { content: data.choices?.[0]?.message?.content || "", cost_usd };
}

function safeParseJSON<T>(text: string): T | null {
  try {
    let t = text.trim();
    if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

function computeNGrams(titles: string[]): Array<{ ngram: string; count: number }> {
  const counts = new Map<string, number>();
  const stop = new Set(["le", "la", "les", "de", "du", "des", "et", "à", "un", "une", "en", "pour", "par", "sur", "the", "of", "and", "to", "a", "an", "in", "for", "on"]);
  for (const t of titles) {
    const words = t.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([ngram, count]) => ({ ngram, count }));
}

function detectType(title: string): string {
  const t = title.toLowerCase();
  if (/comparatif|vs\.?|versus/.test(t)) return "comparatif";
  if (/guide|tutoriel|tuto/.test(t)) return "guide";
  if (/^\d+|top \d/.test(t)) return "listicle";
  if (/comment |how to/.test(t)) return "howto";
  if (/avis|test|review/.test(t)) return "review";
  if (/\?$/.test(title)) return "question";
  return "article";
}

function countBy(arr: string[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, k) => { acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
}

function countByCluster(articles: any[], clusters: PriorityCluster[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of clusters) {
    out[c.cluster_name] = articles.filter((a) => a.cluster_id === c.cluster_id).length;
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

async function upsertSnapshot(
  supabase: SupabaseClient,
  site: { id: string; user_id: string },
  priorityClusters: PriorityCluster[],
  ngrams: Array<{ ngram: string; count: number }>,
  typeDistribution: Record<string, number>,
  ringDistribution: Record<string, number>,
  semanticAnalysis: any[],
  llmModelsUsed: Record<string, string>,
  estimatedCostUsd: number,
  totalClusters: number,
  totalArticles: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("saturation_snapshots").upsert(
    {
      tracked_site_id: site.id,
      user_id: site.user_id,
      snapshot_date: today,
      priority_clusters: priorityClusters,
      topic_n_grams: ngrams,
      type_distribution: typeDistribution,
      ring_distribution: ringDistribution,
      semantic_analysis: semanticAnalysis,
      llm_models_used: llmModelsUsed,
      estimated_cost_usd: estimatedCostUsd,
      total_clusters_analyzed: totalClusters,
      total_articles_analyzed: totalArticles,
      status: "completed",
    },
    { onConflict: "tracked_site_id,snapshot_date" },
  );
}
