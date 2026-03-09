import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate news cards (green)
    const newsPrompt = `Génère exactement 5 actualités très courtes (max 450 caractères chacune) sur le référencement SEO/GEO en 2025-2026. 
Sujets possibles : changements d'algorithmes Google, nouveautés des LLMs (ChatGPT, Claude, Perplexity, Gemini), tendances réseaux sociaux pour le SEO, évolutions du crawling IA, nouvelles fonctionnalités SERP (SGE, AI Overviews).
Chaque news doit être factuelle, percutante, et donner une info actionnable.
Retourne un JSON array avec des objets : {"content": "...", "category": "seo|geo|llm|social", "relevance_score": 50-100}
Pas de markdown, juste le JSON array.`;

    const tipsPrompt = `Génère exactement 5 conseils/astuces très courts (max 450 caractères chacun) sur le référencement SEO/GEO.
Sujets possibles : optimisation E-E-A-T, crawlability, données structurées JSON-LD, stratégie réseaux sociaux pour la visibilité IA, GEO (Generative Engine Optimization), optimisation pour les LLMs, Core Web Vitals, maillage interne.
Chaque conseil doit être concret, actionnable, et apporter une vraie valeur.
Retourne un JSON array avec des objets : {"content": "...", "category": "seo|geo|eeat|crawlability|social", "relevance_score": 50-100}
Pas de markdown, juste le JSON array.`;

    // Generate both in parallel
    const [newsRes, tipsRes] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: newsPrompt }],
          temperature: 0.8,
        }),
      }),
      fetch("https://lovable.dev/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: tipsPrompt }],
          temperature: 0.8,
        }),
      }),
    ]);

    const newsData = await newsRes.json();
    const tipsData = await tipsRes.json();

    const parseItems = (data: any): any[] => {
      try {
        const text = data.choices?.[0]?.message?.content || "";
        const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
      } catch {
        return [];
      }
    };

    const newsItems = parseItems(newsData);
    const tipItems = parseItems(tipsData);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const cards = [
      ...newsItems.map((item: any) => ({
        card_type: "news",
        content: String(item.content || "").slice(0, 500),
        category: item.category || "seo",
        relevance_score: Math.min(100, Math.max(0, item.relevance_score || 70)),
        freshness_score: 100,
        language: "fr",
        is_active: true,
        expires_at: expiresAt.toISOString(),
      })),
      ...tipItems.map((item: any) => ({
        card_type: "tip",
        content: String(item.content || "").slice(0, 500),
        category: item.category || "seo",
        relevance_score: Math.min(100, Math.max(0, item.relevance_score || 70)),
        freshness_score: 100,
        language: "fr",
        is_active: true,
        expires_at: expiresAt.toISOString(),
      })),
    ];

    if (cards.length > 0) {
      // Deactivate old cards with low freshness
      await supabase
        .from("patience_cards")
        .update({ freshness_score: Math.max(0, 50) })
        .lt("created_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString());

      // Deactivate very old cards
      await supabase
        .from("patience_cards")
        .update({ is_active: false })
        .lt("created_at", new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString());

      const { error } = await supabase.from("patience_cards").insert(cards);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, generated: cards.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating patience cards:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
