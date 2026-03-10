import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pool d'images Unsplash variées pour éviter les doublons
const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&q=80",
  "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=1200&q=80",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f2?w=1200&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80",
  "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=1200&q=80",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&q=80",
  "https://images.unsplash.com/photo-1542744094-24638eff58bb?w=1200&q=80",
  "https://images.unsplash.com/photo-1517433456624-0f3a57a6b9c8?w=1200&q=80",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80",
  "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=1200&q=80",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
  "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=80",
  "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80",
];

async function getUsedImages(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from("blog_articles")
    .select("image_url")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  return (data || []).map((a: any) => a.image_url).filter(Boolean);
}

function pickUniqueImage(usedImages: string[]): string {
  const available = IMAGE_POOL.filter((img) => !usedImages.includes(img));
  if (available.length === 0) return IMAGE_POOL[Math.floor(Math.random() * IMAGE_POOL.length)];
  return available[Math.floor(Math.random() * available.length)];
}

async function getRecentArticleTitles(supabase: any): Promise<string[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("blog_articles")
    .select("title, slug")
    .eq("status", "published")
    .gte("published_at", thirtyDaysAgo)
    .order("published_at", { ascending: false })
    .limit(20);
  return (data || []).map((a: any) => `${a.title} (/${a.slug})`);
}

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

    // ─── STEP 0: Get existing articles for dedup + image uniqueness ───
    const [recentTitles, usedImages] = await Promise.all([
      getRecentArticleTitles(supabase),
      getUsedImages(supabase),
    ]);

    const dedupContext = recentTitles.length > 0
      ? `\n\nARTICLES DÉJÀ PUBLIÉS (NE PAS DUPLIQUER) :\n${recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

    console.log("[blog-gen] Existing articles for dedup:", recentTitles.length);

    // ─── STEP 1: Get latest active news cards (< 30 days only) ───
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newsCards, error: newsErr } = await supabase
      .from("patience_cards")
      .select("id, content, category, created_at")
      .eq("card_type", "news")
      .eq("is_active", true)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (newsErr || !newsCards || newsCards.length === 0) {
      console.log("[blog-gen] No fresh news cards (< 30 days) found, skipping");
      return new Response(
        JSON.stringify({ success: true, generated: 0, reason: "no_fresh_news" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newsContext = newsCards
      .map((c: any) => `[${c.category.toUpperCase()}] (${new Date(c.created_at).toLocaleDateString("fr-FR")}) ${c.content}`)
      .join("\n\n");

    console.log("[blog-gen] Aggregated", newsCards.length, "fresh news cards");

    // ─── STEP 2: Perplexity Sonar — recherche web en temps réel ───
    const searchPrompt = `Voici des actualités SEO/GEO/IA récentes :

${newsContext}

Identifie LE sujet le plus impactant parmi ces actualités. Puis effectue une recherche approfondie sur ce sujet.
IMPORTANT : Nous sommes en ${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}. Ne traite QUE des faits de 2026.
${dedupContext}

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
    const currentDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    
    const articlePrompt = `Tu es le rédacteur en chef de Crawlers.fr, plateforme d'audit SEO et GEO (Generative Engine Optimization).
DATE ACTUELLE : ${currentDate}. Tous les contenus doivent refléter l'actualité de 2026.

## CONTRAINTE ANTI-REDONDANCE CRITIQUE :
Voici les articles DÉJÀ PUBLIÉS ce mois-ci. Tu DOIS traiter un angle DIFFÉRENT :
${recentTitles.map((t) => `- ${t}`).join("\n") || "Aucun article récent."}

Si le sujet est similaire à un article existant, trouve un ANGLE NEUF (ex: impact sectoriel, guide pratique, analyse concurrentielle, étude de cas).

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
    <li>Point clé 1 (avec chiffre VÉRIFIÉ et DATE 2026 OBLIGATOIRE dans au moins un point)</li>
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
   - Le titre SEO ne doit PAS obligatoirement contenir 2026, mais le bloc résumé (summary-card) DOIT mentionner 2026 au moins une fois.

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
            content: "Tu es un rédacteur SEO/GEO expert. Tu produis du contenu factuel basé exclusivement sur les données de recherche fournies. Nous sommes en 2026.",
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
                  title: { type: "string", description: "SEO title < 60 chars with 2026" },
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

    // ─── STEP 5: Pick unique image ───
    const imageUrl = pickUniqueImage(usedImages);

    // ─── STEP 6: Generate EN + ES translations ───
    console.log("[blog-gen] Step 6: Generating EN + ES translations...");

    const translationPrompt = (lang: string, langLabel: string) => `You are a professional SEO translator. Translate this French blog article to ${langLabel}.

RULES:
- Keep ALL HTML structure intact (tags, classes, attributes)
- Keep brand names (Crawlers.fr, Google, ChatGPT, etc.) unchanged
- Keep URLs unchanged
- Adapt cultural references naturally
- The translation must be fluent and native-sounding, NOT literal
- Keep technical SEO/GEO terms that are commonly used in ${langLabel}
- Return ONLY a JSON object with exactly these fields:

{
  "title": "Translated SEO title < 60 chars",
  "excerpt": "Translated meta description < 155 chars",
  "content": "Full translated HTML content"
}

FRENCH ARTICLE TO TRANSLATE:
Title: ${article.title}
Excerpt: ${article.excerpt}
Content: ${article.content}`;

    const [enRes, esRes] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a professional translator. Return only valid JSON." },
            { role: "user", content: translationPrompt("en", "English") },
          ],
          temperature: 0.3,
        }),
      }),
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a professional translator. Return only valid JSON." },
            { role: "user", content: translationPrompt("es", "Spanish") },
          ],
          temperature: 0.3,
        }),
      }),
    ]);

    let enArticle: any = null;
    let esArticle: any = null;

    for (const [res, lang] of [[enRes, "en"], [esRes, "es"]] as const) {
      try {
        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content || "";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (lang === "en") enArticle = parsed;
          else esArticle = parsed;
          console.log(`[blog-gen] ✅ ${lang.toUpperCase()} translation ready`);
        } else {
          console.warn(`[blog-gen] ⚠️ ${lang.toUpperCase()} translation failed: ${res.status}`);
        }
      } catch (e) {
        console.warn(`[blog-gen] ⚠️ ${lang.toUpperCase()} translation parse error:`, e);
      }
    }

    // ─── STEP 7: Insert into blog_articles ───
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from("blog_articles")
      .insert({
        slug: article.slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || "",
        image_url: imageUrl,
        status: "published",
        published_at: now,
        title_en: enArticle?.title || null,
        title_es: esArticle?.title || null,
        excerpt_en: enArticle?.excerpt || null,
        excerpt_es: esArticle?.excerpt || null,
        content_en: enArticle?.content || null,
        content_es: esArticle?.content || null,
      })
      .select("id, slug")
      .single();

    if (insertErr) {
      console.error("[blog-gen] Insert error:", insertErr);
      throw insertErr;
    }

    console.log("[blog-gen] ✅ Article published:", inserted.slug, `(${contentLength} chars, image: ${imageUrl}, EN: ${!!enArticle}, ES: ${!!esArticle})`);

    // ─── STEP 8: Ping Google sitemap for instant indexation ───
    const sitemapUrl = `${supabaseUrl}/functions/v1/sitemap`;
    const pingUrls = [
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    for (const pingUrl of pingUrls) {
      try {
        const pingRes = await fetch(pingUrl, { method: "GET" });
        console.log(`[blog-gen] Ping ${new URL(pingUrl).hostname}: ${pingRes.status}`);
      } catch (e) {
        console.warn(`[blog-gen] Ping failed for ${pingUrl}:`, e);
      }
    }

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
          imageUrl,
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
