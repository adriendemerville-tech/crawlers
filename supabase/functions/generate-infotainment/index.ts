import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = getServiceClient();

    console.log("[infotainment] Starting generation pipeline...");

    // ─── STEP 1: Web research via Gemini grounding ───
    const searchPrompt = `Tu es un veilleur SEO/GEO expert. Recherche les informations les plus récentes (derniers 7 jours) sur :
- Mises à jour algorithmes Google (core updates, spam updates, helpful content)
- Nouvelles fonctionnalités SERP / AI Overviews / SGE
- Actualités des LLMs (ChatGPT, Claude, Gemini, Perplexity) liées au référencement
- Évolutions du crawling IA et GEO (Generative Engine Optimization)
- Tendances E-E-A-T et Core Web Vitals

Retourne un résumé structuré des 5-8 informations les plus importantes et récentes, avec pour chacune : le sujet, la source probable, et la date approximative. Format texte brut.`;

    const searchRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: searchPrompt }],
        temperature: 0.3,
      }),
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("[infotainment] Search step failed:", searchRes.status, errText);
      throw new Error(`AI search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const researchContext = searchData.choices?.[0]?.message?.content || "";
    console.log("[infotainment] Research context gathered:", researchContext.length, "chars");

    // ─── STEP 2: Generate news + hacks with fact-checking ───
    const generationPrompt = `Tu es un expert SEO/GEO. À partir de ces données de veille récente :

---
${researchContext}
---

Génère EXACTEMENT :

**5 "news"** : Des faits SEO/GEO récents (< 7 jours), vérifiés, percutants. Chaque news doit citer un fait précis et actionnable. 500 caractères MAX par item.

**5 "hack"** : Des astuces intemporelles et expertes sur E-E-A-T, crawlability, données structurées, maillage interne, optimisation pour LLMs, GEO. Chaque hack doit être concret et immédiatement applicable. 500 caractères MAX par item.

IMPORTANT:
- Ne génère PAS de contenu spéculatif. Chaque "news" doit être basée sur un fait vérifiable. Les "hack" sont des bonnes pratiques établies.
- Chaque item DOIT contenir entre 1 et 3 emojis pertinents intégrés naturellement dans le texte (ex: 🔍, 🚀, ⚡, 📊, 🤖, 💡, 🎯, 🔗, 📈, ✅). Les emojis rendent le contenu plus engageant et lisible.

Retourne UNIQUEMENT un JSON array (pas de markdown) :
[
  {"type": "news", "content": "...", "category": "seo|geo|llm|social"},
  {"type": "hack", "content": "...", "category": "eeat|crawlability|structured-data|geo|llm"}
]`;

    const genRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: generationPrompt }],
        temperature: 0.7,
      }),
    });

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error("[infotainment] Generation failed:", genRes.status, errText);
      throw new Error(`AI generation failed: ${genRes.status}`);
    }

    const genData = await genRes.json();
    const rawText = genData.choices?.[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let items: any[];
    try {
      items = JSON.parse(cleaned);
    } catch {
      console.error("[infotainment] Failed to parse JSON:", cleaned.slice(0, 200));
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("AI returned empty or invalid items array");
    }

    console.log("[infotainment] Generated", items.length, "items");

    // ─── STEP 3: Freshness algorithm Sf = 100 / (T_current - T_pub) ───
    const now = new Date();

    // Update freshness scores for all existing cards
    const { data: existingCards } = await supabase
      .from("patience_cards")
      .select("id, card_type, created_at, is_active")
      .eq("is_active", true);

    if (existingCards && existingCards.length > 0) {
      const updates = existingCards.map((card) => {
        const createdAt = new Date(card.created_at);
        const daysDiff = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));
        const sf = Math.round((100 / daysDiff) * 10) / 10;

        // News expire when Sf < 10 (> 10 days old). Hacks never expire.
        const isNews = card.card_type === "news";
        const shouldDeactivate = isNews && sf < 10;

        return {
          id: card.id,
          freshness_score: Math.round(sf),
          is_active: shouldDeactivate ? false : card.is_active,
        };
      });

      // Batch update freshness scores
      for (const update of updates) {
        await supabase
          .from("patience_cards")
          .update({
            freshness_score: update.freshness_score,
            is_active: update.is_active,
          })
          .eq("id", update.id);
      }

      const deactivated = updates.filter((u) => !u.is_active).length;
      console.log("[infotainment] Updated freshness for", updates.length, "cards,", deactivated, "deactivated");
    }

    // ─── STEP 4: Insert new cards ───
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const cards = items
      .filter((item) => item.type === "news" || item.type === "hack")
      .map((item) => ({
        card_type: item.type === "hack" ? "tip" : "news", // Map 'hack' to 'tip' for DB compatibility
        content: String(item.content || "").slice(0, 500),
        category: item.category || "seo",
        relevance_score: 80,
        freshness_score: 100,
        language: "fr",
        is_active: true,
        expires_at: expiresAt.toISOString(),
      }));

    if (cards.length > 0) {
      const { error } = await supabase.from("patience_cards").insert(cards);
      if (error) {
        console.error("[infotainment] Insert error:", error);
        throw error;
      }
    }

    console.log("[infotainment] Successfully inserted", cards.length, "new cards");

    // ─── STEP 5: Trigger blog article generation from news ───
    try {
      const blogRes = await fetch(`${supabaseUrl}/functions/v1/generate-blog-from-news`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ trigger: "infotainment" }),
      });
      const blogData = await blogRes.json();
      console.log("[infotainment] Blog generation result:", JSON.stringify(blogData));
    } catch (blogErr) {
      console.error("[infotainment] Blog generation failed (non-blocking):", blogErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: cards.length,
        news: cards.filter((c) => c.card_type === "news").length,
        hacks: cards.filter((c) => c.card_type === "tip").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[infotainment] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
