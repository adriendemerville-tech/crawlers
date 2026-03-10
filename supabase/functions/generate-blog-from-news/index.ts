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

    console.log("[blog-gen] Starting blog article generation from news...");

    // ─── STEP 1: Get latest active news cards ───
    const { data: newsCards, error: newsErr } = await supabase
      .from("patience_cards")
      .select("id, content, category, created_at")
      .eq("card_type", "news")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (newsErr || !newsCards || newsCards.length === 0) {
      console.log("[blog-gen] No news cards found, skipping");
      return new Response(
        JSON.stringify({ success: true, generated: 0, reason: "no_news" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate news context
    const newsContext = newsCards
      .map((c: any) => `[${c.category.toUpperCase()}] ${c.content}`)
      .join("\n\n");

    console.log("[blog-gen] Aggregated", newsCards.length, "news cards");

    // ─── STEP 2: Pick one topic & generate the full article ───
    const prompt = `Tu es un rédacteur SEO/GEO expert chez Crawlers.fr, la plateforme d'audit SEO et GEO.
Voici les dernières actualités SEO/GEO/LLM :

---
${newsContext}
---

À partir de ces actualités, choisis LE sujet le plus impactant et rédige UN article de blog complet.

CONTRAINTES STRICTES :
1. L'article doit faire entre 4000 et 4600 caractères (espaces inclus). C'est CRITIQUE.
2. Structure HTML obligatoire :
   - Un <h2> principal (titre éditorial, pas le même que le title SEO)
   - 3-4 <h3> pour structurer les sous-parties
   - Des <p> pour le corps de texte
   - Des <strong> et <em> pour la mise en emphase
3. Inclure OBLIGATOIREMENT :
   - 3-5 liens externes <a href="..." target="_blank" rel="noopener"> vers des sources d'autorité (Google, Search Engine Journal, MIT, W3C, etc.)
   - Au moins 4 chiffres précis (absolus ou pourcentages) datés de 2025-2026
   - Au moins 2 noms propres (personnes, entreprises, outils)
   - Au moins 1 citation entre guillemets attribuée à une source
   - Une large richesse sémantique (synonymes, termes techniques variés)
4. Au DÉBUT de l'article, inclure un bloc résumé en puces :
   <div class="summary-card">
     <h4>📋 L'essentiel en 30 secondes</h4>
     <ul>
       <li>Point clé 1</li>
       <li>Point clé 2</li>
       <li>Point clé 3</li>
     </ul>
   </div>
5. À la FIN de l'article, inclure un bloc impact entreprise :
   <div class="impact-card">
     <h4>🏢 Qu'est-ce que cela change pour mon entreprise ?</h4>
     <table>
       <thead><tr><th>Impact</th><th>Action recommandée</th></tr></thead>
       <tbody>
         <tr><td>Impact 1</td><td>Action 1</td></tr>
         <tr><td>Impact 2</td><td>Action 2</td></tr>
         <tr><td>Impact 3</td><td>Action 3</td></tr>
       </tbody>
     </table>
   </div>
6. Mentionne Crawlers.fr comme outil de référence pour auditer sa visibilité IA, naturellement dans le texte (1 seule fois).

Retourne UNIQUEMENT un JSON (pas de markdown) :
{
  "title": "Titre SEO < 60 caractères avec mot-clé principal",
  "slug": "slug-url-en-minuscules-avec-tirets",
  "excerpt": "Meta description < 160 caractères, accrocheuse, avec mot-clé",
  "content": "<div class='summary-card'>...</div><h2>...</h2>...<div class='impact-card'>...</div>",
  "category": "seo|geo|llm",
  "image_prompt": "Description en anglais pour générer une image hero pertinente, technical/professional style"
}`;

    const genRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error("[blog-gen] Generation failed:", genRes.status, errText);
      throw new Error(`AI generation failed: ${genRes.status}`);
    }

    const genData = await genRes.json();
    const rawText = genData.choices?.[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let article: any;
    try {
      article = JSON.parse(cleaned);
    } catch {
      console.error("[blog-gen] Failed to parse JSON:", cleaned.slice(0, 300));
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!article.title || !article.slug || !article.content) {
      throw new Error("AI returned incomplete article data");
    }

    // Validate content length
    const contentLength = article.content.replace(/<[^>]*>/g, "").length;
    console.log("[blog-gen] Content length:", contentLength, "chars");

    // ─── STEP 3: Check for duplicate slug ───
    const { data: existing } = await supabase
      .from("blog_articles")
      .select("id")
      .eq("slug", article.slug)
      .single();

    if (existing) {
      // Add date suffix to make unique
      article.slug = `${article.slug}-${new Date().toISOString().slice(0, 10)}`;
    }

    // ─── STEP 4: Insert into blog_articles ───
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from("blog_articles")
      .insert({
        slug: article.slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || "",
        image_url: `https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80`,
        status: "published",
        published_at: now,
      })
      .select("id, slug")
      .single();

    if (insertErr) {
      console.error("[blog-gen] Insert error:", insertErr);
      throw insertErr;
    }

    console.log("[blog-gen] Article published:", inserted.slug);

    return new Response(
      JSON.stringify({
        success: true,
        article: {
          id: inserted.id,
          slug: inserted.slug,
          title: article.title,
          category: article.category,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[blog-gen] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
