/**
 * correlate-bot-to-human
 * ----------------------
 * Sprint 2 GEO — Bot IA ↔ Human Correlation.
 *
 * Pour chaque visite humaine récente avec un referer IA (ChatGPT, Claude,
 * Perplexity, Gemini, Copilot…), on cherche les bot_hits IA associés
 * (même tracked_site_id + même path) dans une fenêtre stricte de 30 jours
 * AVANT la visite, puis on calcule un poids par hit avec décroissance
 * temporelle exp(-days_before / 15).
 *
 * Modèle multi-touch pondéré :
 *   weight_i = exp(-Δjours / 15) / Σ exp(-Δjours / 15)
 * Σ poids = 1, top hit = poids max.
 *
 * Idempotent : on ne ré-attribue pas une session déjà traitée
 * (clé = session_fingerprint + visited_at à la minute).
 *
 * Déclenché par cron 6h ou manuellement (admin).
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { getServiceClient } from "../_shared/supabaseClient.ts";

// ----- Sources IA reconnues (referer host → libellé canonique) -----
const AI_REFERER_PATTERNS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /chat\.openai\.com|chatgpt\.com/i, source: "chatgpt" },
  { pattern: /claude\.ai|anthropic\.com/i, source: "claude" },
  { pattern: /perplexity\.ai/i, source: "perplexity" },
  { pattern: /gemini\.google\.com|bard\.google\.com/i, source: "gemini" },
  { pattern: /copilot\.microsoft\.com|bing\.com\/chat/i, source: "copilot" },
  { pattern: /you\.com/i, source: "you" },
  { pattern: /poe\.com/i, source: "poe" },
];

function detectAiSource(referer: string | null): string | null {
  if (!referer) return null;
  for (const { pattern, source } of AI_REFERER_PATTERNS) {
    if (pattern.test(referer)) return source;
  }
  return null;
}

const ATTRIBUTION_WINDOW_DAYS = 30;
const HALF_LIFE_DAYS = 15; // exp(-Δ/15) → poids 0.5 à 10j, 0.13 à 30j

interface AnalyticsRow {
  id: string;
  url: string | null;
  target_url: string | null;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  event_data: Record<string, unknown> | null;
}

interface BotHitRow {
  id: number;
  bot_name: string;
  hit_at: string;
  path: string;
  tracked_site_id: string;
  user_id: string;
  domain: string;
  country: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const url = new URL(req.url);
    const lookbackHours = Number(url.searchParams.get("lookback_hours") ?? "24");
    const lookbackSince = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();

    // 1) Récupérer les events analytics récents avec un referer IA potentiel.
    //    On stocke le referer dans event_data.referer côté track-analytics.
    const { data: events, error: evErr } = await supabase
      .from("analytics_events")
      .select("id, url, target_url, user_id, session_id, created_at, event_data")
      .gte("created_at", lookbackSince)
      .in("event_type", ["pageview", "page_view", "visit"])
      .limit(5000);

    if (evErr) throw evErr;

    const candidates = (events ?? []).filter((e) => {
      const referer = (e.event_data?.referer as string | undefined) ?? null;
      return detectAiSource(referer) !== null;
    });

    let inserted = 0;
    let skipped = 0;

    for (const ev of candidates as AnalyticsRow[]) {
      const referer = (ev.event_data?.referer as string | undefined) ?? null;
      const aiSource = detectAiSource(referer);
      if (!aiSource) continue;

      const visitUrl = ev.target_url || ev.url;
      if (!visitUrl) continue;

      let host = "";
      let path = "/";
      try {
        const u = new URL(visitUrl);
        host = u.hostname.replace(/^www\./, "");
        path = u.pathname || "/";
      } catch {
        continue;
      }

      // 2) Trouver le tracked_site correspondant au domaine
      const { data: site } = await supabase
        .from("tracked_sites")
        .select("id, user_id, domain")
        .or(`domain.eq.${host},domain.eq.www.${host}`)
        .maybeSingle();
      if (!site) continue;

      // 3) Idempotence : skip si déjà attribué (même session + même minute)
      const fingerprintInput = `${ev.session_id ?? ""}|${(ev.event_data?.ua as string) ?? ""}|${(ev.event_data?.ip as string) ?? ""}`;
      const fingerprint = await sha256(fingerprintInput);
      const visitedAt = ev.created_at;

      const { data: existing } = await supabase
        .from("ai_attribution_events")
        .select("id")
        .eq("session_fingerprint", fingerprint)
        .eq("visited_at", visitedAt)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      // 4) Chercher les bot_hits IA pour cette page dans la fenêtre 30j AVANT
      const visitDate = new Date(visitedAt);
      const windowStart = new Date(visitDate.getTime() - ATTRIBUTION_WINDOW_DAYS * 86400 * 1000).toISOString();

      const { data: hits } = await supabase
        .from("bot_hits")
        .select("id, bot_name, hit_at, path, tracked_site_id, user_id, domain, country")
        .eq("tracked_site_id", site.id)
        .eq("path", path)
        .gte("hit_at", windowStart)
        .lte("hit_at", visitedAt)
        .ilike("bot_category", "ai%")
        .order("hit_at", { ascending: false })
        .limit(50);

      if (!hits || hits.length === 0) continue;

      // 5) Calcul des poids multi-touch (décroissance exp)
      const weighted = (hits as BotHitRow[]).map((h) => {
        const deltaDays = (visitDate.getTime() - new Date(h.hit_at).getTime()) / 86400000;
        const raw = Math.exp(-deltaDays / HALF_LIFE_DAYS);
        return { hit: h, deltaDays, raw };
      });
      const sumRaw = weighted.reduce((s, w) => s + w.raw, 0);
      const normalized = weighted.map((w) => ({
        bot_hit_id: w.hit.id,
        bot_name: w.hit.bot_name,
        hit_at: w.hit.hit_at,
        delta_days: Number(w.deltaDays.toFixed(2)),
        weight: Number((w.raw / sumRaw).toFixed(4)),
      }));
      const top = normalized.reduce((a, b) => (a.weight >= b.weight ? a : b));

      // 6) Insertion
      const { error: insErr } = await supabase.from("ai_attribution_events").insert({
        tracked_site_id: site.id,
        user_id: site.user_id,
        domain: site.domain,
        url: visitUrl,
        path,
        ai_source: aiSource,
        referer_full: referer,
        visited_at: visitedAt,
        country: (ev.event_data?.country as string) ?? null,
        session_fingerprint: fingerprint,
        attribution_model: "multi_touch_weighted",
        attribution_window_days: ATTRIBUTION_WINDOW_DAYS,
        source_bot_hit_id: top.bot_hit_id,
        top_attributed_bot: top.bot_name,
        attributed_count: normalized.length,
        attributed_bot_hits: normalized,
        total_weight: 1,
      });
      if (insErr) {
        console.error("[correlate-bot-to-human] insert error", insErr);
        continue;
      }
      inserted++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: candidates.length,
        inserted,
        skipped,
        lookback_hours: lookbackHours,
        window_days: ATTRIBUTION_WINDOW_DAYS,
        half_life_days: HALF_LIFE_DAYS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[correlate-bot-to-human] fatal", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
