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
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY")!;
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

    const newsContext = newsCards
      .map((c: any) => `[${c.category.toUpperCase()}] ${c.content}`)
      .join("\n\n");

    console.log("[blog-gen] Aggregated", newsCards.length, "news cards");

    // ─── STEP 2: Perplexity Sonar — recherche web en temps réel ───
    const searchPrompt = `Voici des actualités SEO/GEO/IA récentes :

${newsContext}

Identifie LE sujet le plus impactant parmi ces actualités. Puis effectue une recherche approfondie sur ce sujet.

Retourne UNIQUEMENT un JSON valide avec :
{
  "topic": "Le sujet principal identifié",
  "facts": [
    {"stat": "chiffre ou pourcentage précis", "source": "nom de la source", "url": "URL de la source", "date": "date de la stat"},
    ...au moins 5 faits
  ],
  "quotes": [
    {"text": "citation exacte", "author": "nom complet", "role": "poste/titre", "source_url": "URL"},
    ...au moins 2 citations
  ],
  "authority_links": [
    {"title": "titre descriptif", "url": "URL vers source d'autorité"},
    ...au moins 4 liens
  ],
  "entities": ["liste de noms propres, entreprises, outils mentionnés"],
  "summary": "Résumé factuel en 200 mots du sujet avec données vérifiées"
}`;

    console.log("[blog-gen] Step 2: Calling Perplexity Sonar via OpenRouter for web search...");

    const searchRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://crawlers.fr",
        "X-Title": "Crawlers.fr Blog Generator",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [
          { role: "system", content: "Tu es un chercheur expert en SEO et IA. Retourne uniquement du JSON valide, sans markdown." },
          { role: "user", content: searchPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("[blog-gen] Perplexity search failed:", searchRes.status, errText);
      throw new Error(`Web search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const searchRaw = searchData.choices?.[0]?.message?.content || "";
    const searchCleaned = searchRaw.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let researchData: any;
    try {
      researchData = JSON.parse(searchCleaned);
    } catch {
      console.error("[blog-gen] Failed to parse search JSON, using raw text as context");
      researchData = { summary: searchCleaned, facts: [], quotes: [], authority_links: [], entities: [] };
    }

    console.log("[blog-gen] Research data obtained:", researchData.topic || "topic extracted");

    // ─── STEP 3: Gemini — rédaction de l'article avec données sourcées ───
    const articlePrompt = `Tu es le rédacteur en chef de Crawlers.fr, plateforme d'audit SEO et GEO (Generative Engine Optimization).

## DONNÉES DE RECHERCHE VÉRIFIÉES (utilisées comme sources primaires) :

**Sujet :** ${researchData.topic || "SEO et visibilité IA en 2026"}

**Faits et chiffres sourcés :**
${(researchData.facts || []).map((f: any) => `- ${f.stat} (Source: ${f.source}, ${f.date || "2026"}) [${f.url || ""}]`).join("\n")}

**Citations exactes :**
${(researchData.quotes || []).map((q: any) => `- « ${q.text} » — ${q.author}, ${q.role} [${q.source_url || ""}]`).join("\n")}

**Liens d'autorité disponibles :**
${(researchData.authority_links || []).map((l: any) => `- ${l.title}: ${l.url}`).join("\n")}

**Entités nommées :** ${(researchData.entities || []).join(", ")}

**Contexte :** ${researchData.summary || newsContext}

## CONTRAINTES DE RÉDACTION STRICTES :

1. **Longueur : entre 4000 et 4600 caractères** (espaces inclus). Compte les caractères du HTML brut sans les balises. C'est CRITIQUE et NON NÉGOCIABLE.

2. **Structure HTML obligatoire :**
   - Un <h2> principal (titre éditorial différent du titre SEO)
   - 3-4 <h3> pour structurer les sous-parties
   - Des <p> pour le corps de texte
   - Des <strong> et <em> pour la mise en emphase sémantique

3. **Bloc résumé AU DÉBUT :**
<div class="summary-card">
  <h4>📋 L'essentiel en 30 secondes</h4>
  <ul>
    <li>Point clé 1 (avec chiffre)</li>
    <li>Point clé 2</li>
    <li>Point clé 3</li>
    <li>Point clé 4</li>
  </ul>
</div>

4. **Bloc impact À LA FIN :**
<div class="impact-card">
  <h4>🏢 Qu'est-ce que cela change pour mon entreprise ?</h4>
  <table>
    <thead><tr><th>Impact</th><th>Action recommandée</th></tr></thead>
    <tbody>
      <tr><td>Impact concret 1</td><td>Action précise 1</td></tr>
      <tr><td>Impact concret 2</td><td>Action précise 2</td></tr>
      <tr><td>Impact concret 3</td><td>Action précise 3</td></tr>
    </tbody>
  </table>
</div>

5. **Obligations de contenu :**
   - Utiliser UNIQUEMENT les chiffres fournis dans les données de recherche ci-dessus. NE PAS inventer de statistiques.
   - Inclure AU MOINS 3 liens <a href="URL_RÉELLE" target="_blank" rel="noopener"> vers les sources d'autorité listées.
   - Inclure AU MOINS 1 citation avec attribution (nom, poste).
   - Vocabulaire riche : synonymes, termes techniques variés, entités nommées.
   - Mentionner Crawlers.fr UNE SEULE FOIS, naturellement, comme outil de diagnostic SEO/GEO.

6. **Retourne UNIQUEMENT un JSON valide (pas de markdown) :**
{
  "title": "Titre SEO < 60 caractères avec mot-clé principal",
  "slug": "slug-url-minuscules-tirets-sans-accents",
  "excerpt": "Meta description < 155 caractères, accrocheuse, mot-clé inclus",
  "content": "<div class='summary-card'>...</div><h2>...</h2>...<div class='impact-card'>...</div>",
  "category": "seo|geo|llm|ia",
  "keywords": "mot-clé 1, mot-clé 2, mot-clé 3, mot-clé 4, mot-clé 5"
}`;

    console.log("[blog-gen] Step 3: Calling Gemini for article writing with tool calling...");

    const genRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Tu es un rédacteur SEO/GEO expert. Tu produis du contenu factuel basé exclusivement sur les données de recherche fournies.",
          },
          { role: "user", content: articlePrompt },
        ],
        temperature: 0.6,
        tools: [
          {
            type: "function",
            function: {
              name: "publish_article",
              description: "Publish a blog article with SEO-optimized content",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "SEO title < 60 chars" },
                  slug: { type: "string", description: "URL slug lowercase with dashes, no accents" },
                  excerpt: { type: "string", description: "Meta description < 155 chars" },
                  content: { type: "string", description: "Full HTML article content with summary-card and impact-card divs" },
                  category: { type: "string", enum: ["seo", "geo", "llm", "ia"] },
                  keywords: { type: "string", description: "Comma-separated keywords" },
                },
                required: ["title", "slug", "excerpt", "content", "category", "keywords"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "publish_article" } },
      }),
    });

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error("[blog-gen] Generation failed:", genRes.status, errText);
      throw new Error(`AI generation failed: ${genRes.status}`);
    }

    const genData = await genRes.json();
    
    let article: any;
    
    // Try tool call first
    const toolCall = genData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        article = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("[blog-gen] Failed to parse tool call arguments");
      }
    }
    
    // Fallback to content parsing
    if (!article) {
      const rawText = genData.choices?.[0]?.message?.content || "";
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      try {
        article = JSON.parse(cleaned);
      } catch {
        console.error("[blog-gen] Failed to parse JSON fallback:", cleaned.slice(0, 500));
        throw new Error("Failed to parse AI response");
      }
    }

    if (!article.title || !article.slug || !article.content) {
      throw new Error("AI returned incomplete article data");
    }

    // Validate content length (text only, no HTML tags)
    const textOnly = article.content.replace(/<[^>]*>/g, "");
    const contentLength = textOnly.length;
    console.log("[blog-gen] Content length:", contentLength, "chars (target: 4000-4600)");

    if (contentLength < 3500) {
      console.warn("[blog-gen] Content too short, may need regeneration");
    }

    // ─── STEP 4: Check for duplicate slug ───
    const { data: existing } = await supabase
      .from("blog_articles")
      .select("id")
      .eq("slug", article.slug)
      .single();

    if (existing) {
      article.slug = `${article.slug}-${new Date().toISOString().slice(0, 10)}`;
    }

    // ─── STEP 5: Insert into blog_articles ───
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from("blog_articles")
      .insert({
        slug: article.slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || "",
        image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
        status: "published",
        published_at: now,
      })
      .select("id, slug")
      .single();

    if (insertErr) {
      console.error("[blog-gen] Insert error:", insertErr);
      throw insertErr;
    }

    console.log("[blog-gen] ✅ Article published:", inserted.slug, `(${contentLength} chars)`);

    return new Response(
      JSON.stringify({
        success: true,
        article: {
          id: inserted.id,
          slug: inserted.slug,
          title: article.title,
          category: article.category,
          keywords: article.keywords,
          contentLength,
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
