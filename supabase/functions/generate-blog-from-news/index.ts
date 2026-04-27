import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { callOpenRouter } from '../_shared/openRouterAI.ts';
import { callLovableAI } from '../_shared/lovableAI.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { toFrenchSentenceCase, normalizeHtmlHeadings } from '../_shared/sentenceCase.ts';

/**
 * Blog Article Generator v2
 * 
 * Inspiré des moteurs d'audit technique et stratégique :
 * - getSiteContext pour l'identité de marque contextuelle
 * - Scoring qualité post-génération multi-axes (heading, E-E-A-T, maillage, keyword)
 * - DataForSEO trending keywords pour guider le choix de sujet
 * - Maillage interne intelligent basé sur les pages existantes
 * - Validation contenu rigoureuse avant publication
 * - Lovable AI Gateway avec tool calling
 */

// Pool d'images Unsplash variées
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

// ─── Key internal pages for smart linking (from audit patterns) ──────
const INTERNAL_PAGES = [
  { path: '/audit-expert', label: 'audit SEO technique', keywords: ['audit', 'technique', 'seo', '200 points', 'expert'] },
  { path: '/generative-engine-optimization', label: 'GEO Score', keywords: ['geo', 'generative', 'llm', 'visibilité ia', 'chatgpt'] },
  { path: '/tarifs', label: 'tarifs et crédits', keywords: ['prix', 'tarif', 'crédit', 'abonnement', 'pro agency'] },
  { path: '/blog', label: 'blog Crawlers.fr', keywords: ['article', 'actualité', 'tendance'] },
  { path: '/lexique', label: 'lexique SEO/GEO', keywords: ['définition', 'glossaire', 'lexique', 'terme'] },
  { path: '/methodologie', label: 'méthodologie', keywords: ['algorithme', 'méthode', 'score', 'calcul'] },
  { path: '/indice-alignement-strategique', label: 'IAS', keywords: ['ias', 'alignement', 'stratégique', 'indice'] },
  { path: '/aide', label: 'centre d\'aide', keywords: ['aide', 'documentation', 'support', 'faq'] },
  { path: '/app/cocoon', label: 'cocon sémantique', keywords: ['cocon', 'sémantique', 'maillage', 'cluster'] },
  { path: '/faq', label: 'FAQ', keywords: ['question', 'fréquente', 'réponse'] },
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

// ─── Post-generation quality scoring (inspired by expert-audit) ──────
interface ArticleQualityScore {
  overall: number;
  heading_structure: number;
  internal_linking: number;
  keyword_density: number;
  eeat_signals: number;
  data_density: number;
  content_length: number;
  issues: string[];
}

function scoreGeneratedArticle(htmlContent: string): ArticleQualityScore {
  const issues: string[] = [];
  const textOnly = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerText = textOnly.toLowerCase();

  // Heading structure
  const h2Count = (htmlContent.match(/<h2/gi) || []).length;
  const h3Count = (htmlContent.match(/<h3/gi) || []).length;
  let headingScore = 0;
  if (h2Count >= 1) headingScore += 30;
  if (h3Count >= 2) headingScore += 30;
  if (h2Count + h3Count >= 4) headingScore += 40;
  else if (h2Count + h3Count < 2) issues.push('Structure Hn insuffisante');

  // Internal linking
  const internalLinks = (htmlContent.match(/href=["']\/[^"']*["']/gi) || []).length;
  const crawlersLinks = (htmlContent.match(/crawlers\.fr/gi) || []).length;
  let linkScore = Math.min(100, internalLinks * 15 + crawlersLinks * 10);
  if (internalLinks < 2) issues.push('Maillage interne insuffisant');

  // Keyword density (SEO/GEO terms)
  const seoTerms = ['seo', 'geo', 'audit', 'llm', 'ia', 'google', 'optimisation', 'référencement', 'visibilité', 'chatgpt', 'perplexity', 'gemini', 'json-ld', 'e-e-a-t'];
  const hits = seoTerms.filter(t => lowerText.includes(t)).length;
  const kwScore = Math.min(100, Math.round((hits / 8) * 100));

  // E-E-A-T signals
  let eeatScore = 0;
  if (/\d+\s*%/.test(textOnly)) eeatScore += 20; // has percentages
  if (/selon|d'après|étude|rapport|source/i.test(textOnly)) eeatScore += 20; // has citations
  if (/<a[^>]*href=["']https?:\/\//i.test(htmlContent)) eeatScore += 20; // external authority links
  if (/expert|spécialiste|consultant|analyste/i.test(textOnly)) eeatScore += 20; // expertise markers
  if (/\d{4}/.test(textOnly)) eeatScore += 20; // has dates/years

  // Data density
  const numberMatches = textOnly.match(/\d+[\.,]?\d*\s*(%|€|\$|x|fois|points?|jours?|mois|milliard|million)/gi) || [];
  const dataScore = Math.min(100, numberMatches.length * 20);
  if (numberMatches.length < 3) issues.push('Données chiffrées insuffisantes');

  // Content length
  const contentLength = textOnly.length;
  let lengthScore = 0;
  if (contentLength >= 4000 && contentLength <= 4600) lengthScore = 100;
  else if (contentLength >= 3500 && contentLength <= 5000) lengthScore = 70;
  else if (contentLength >= 3000) lengthScore = 40;
  else { lengthScore = 20; issues.push(`Contenu trop court: ${contentLength} car. (cible: 4000-4600)`); }

  // Summary/impact cards
  if (!htmlContent.includes('summary-card')) issues.push('Bloc résumé manquant');
  if (!htmlContent.includes('impact-card')) issues.push('Bloc impact manquant');

  const overall = Math.round(
    headingScore * 0.15 +
    linkScore * 0.20 +
    kwScore * 0.15 +
    eeatScore * 0.20 +
    dataScore * 0.15 +
    lengthScore * 0.15
  );

  return {
    overall,
    heading_structure: headingScore,
    internal_linking: linkScore,
    keyword_density: kwScore,
    eeat_signals: eeatScore,
    data_density: dataScore,
    content_length: lengthScore,
    issues,
  };
}

// ─── Suggest internal links based on article content (from audit link profile) ──
function suggestInternalLinks(content: string): string[] {
  const lowerContent = content.toLowerCase();
  const suggestions: string[] = [];

  for (const page of INTERNAL_PAGES) {
    const hasLink = content.includes(`href="${page.path}"`) || content.includes(`href="https://crawlers.fr${page.path}"`);
    if (hasLink) continue;

    const relevance = page.keywords.filter(kw => lowerContent.includes(kw)).length;
    if (relevance >= 2) {
      suggestions.push(`Ajouter un lien vers ${page.path} (${page.label}) — ${relevance} mots-clés trouvés`);
    }
  }

  return suggestions;
}

// ─── Fetch trending keywords from DataForSEO cache ──────────────────
async function getTrendingKeywords(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('domain_data_cache')
      .select('result_data')
      .eq('domain', 'crawlers.fr')
      .eq('data_type', 'ranked_keywords')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.result_data?.top_keywords) {
      return data.result_data.top_keywords
        .slice(0, 10)
        .map((k: any) => k.keyword)
        .filter(Boolean);
    }
  } catch { /* ignore */ }
  return [];
}

Deno.serve(handleRequest(async (req) => {
try {
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = getServiceClient();

    console.log("[blog-gen v2] Starting blog article generation...");

    // ─── STEP 0: Parallel context gathering (like strategic audit WAVE pattern) ───
    const [recentTitles, usedImages, siteContext, trendingKeywords] = await Promise.all([
      getRecentArticleTitles(supabase),
      getUsedImages(supabase),
      getSiteContext(supabase, { domain: 'crawlers.fr' }).catch(() => null),
      getTrendingKeywords(supabase),
    ]);

    const dedupContext = recentTitles.length > 0
      ? `\n\nARTICLES DÉJÀ PUBLIÉS (NE PAS DUPLIQUER) :\n${recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

    const trendingContext = trendingKeywords.length > 0
      ? `\n\nMOTS-CLÉS TENDANCE (DataForSEO) à intégrer naturellement :\n${trendingKeywords.map(k => `- ${k}`).join('\n')}`
      : "";

    const siteIdentity = siteContext
      ? `\n\nIDENTITÉ SITE :\n- Marque : ${siteContext.brand_name || siteContext.site_name || 'Crawlers.fr'}\n- Secteur : ${siteContext.market_sector || 'SEO/GEO'}\n- Audience : ${siteContext.target_audience || 'Agences SEO, freelances, PME'}\n- Zone : ${siteContext.commercial_area || 'France, Europe francophone'}`
      : "";

    console.log(`[blog-gen v2] Context: ${recentTitles.length} recent articles, ${trendingKeywords.length} trending keywords, site identity: ${!!siteContext}`);

    // ─── STEP 1: Get latest active news cards (< 30 days) ───
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
      console.log("[blog-gen v2] No fresh news cards (< 30 days) found, skipping");
      return jsonOk({ success: true, generated: 0, reason: "no_fresh_news" });
    }

    const newsContext = newsCards
      .map((c: any) => `[${c.category.toUpperCase()}] (${new Date(c.created_at).toLocaleDateString("fr-FR")}) ${c.content}`)
      .join("\n\n");

    console.log("[blog-gen v2] Aggregated", newsCards.length, "fresh news cards");

    // ─── STEP 2: Perplexity Sonar — web research ───
    const searchPrompt = `Voici des actualités SEO/GEO/IA récentes :

${newsContext}

Identifie LE sujet le plus impactant parmi ces actualités. Puis effectue une recherche approfondie.
IMPORTANT : Nous sommes en ${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}. Ne traite QUE des faits de 2026.
${dedupContext}
${trendingContext}

Retourne UNIQUEMENT un JSON valide avec :
{
  "topic": "Le sujet principal identifié",
  "facts": [{"stat": "chiffre précis", "source": "nom source", "url": "URL", "date": "date stat"}],
  "quotes": [{"text": "citation exacte", "author": "nom complet", "role": "poste", "source_url": "URL"}],
  "authority_links": [{"title": "titre", "url": "URL vers source d'autorité"}],
  "entities": ["liste de noms propres, entreprises, outils"],
  "summary": "Résumé factuel en 200 mots"
}`;

    console.log("[blog-gen v2] Step 2: Calling Perplexity Sonar...");

    const searchResp = await callOpenRouter({
      model: 'perplexity/sonar',
      system: "Tu es un chercheur expert en SEO et IA. Retourne uniquement du JSON valide, sans markdown.",
      user: searchPrompt,
      title: 'Crawlers.fr Blog Generator v2',
    });

    const searchRaw = searchResp.content;
    const searchCleaned = searchRaw.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    trackPaidApiCall('generate-blog-from-news', 'openrouter', 'perplexity/sonar');

    let researchData: any;
    try {
      researchData = JSON.parse(searchCleaned);
    } catch {
      console.error("[blog-gen v2] Failed to parse search JSON, using raw text");
      researchData = { summary: searchCleaned, facts: [], quotes: [], authority_links: [], entities: [] };
    }

    console.log("[blog-gen v2] Research data obtained:", researchData.topic || "topic extracted");

    // ─── STEP 3: Gemini article writing with enriched context ───
    const currentDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    // Build internal linking instructions (from audit link profile pattern)
    const linkingInstructions = INTERNAL_PAGES
      .filter(() => Math.random() > 0.4) // Select ~60% of pages to avoid over-linking
      .slice(0, 5)
      .map(p => `- <a href="https://crawlers.fr${p.path}">${p.label}</a> (si pertinent pour : ${p.keywords.slice(0, 3).join(', ')})`)
      .join('\n');

    const articlePrompt = `Tu es le rédacteur en chef de Crawlers.fr, plateforme d'audit SEO et GEO (Generative Engine Optimization).
DATE ACTUELLE : ${currentDate}. Tous les contenus doivent refléter l'actualité de 2026.
${siteIdentity}

## CONTRAINTE ANTI-REDONDANCE CRITIQUE :
${recentTitles.map((t) => `- ${t}`).join("\n") || "Aucun article récent."}
Tu DOIS traiter un angle DIFFÉRENT.

## DONNÉES DE RECHERCHE VÉRIFIÉES :
**Sujet :** ${researchData.topic || "SEO et visibilité IA en 2026"}
**Faits sourcés :**
${(researchData.facts || []).map((f: any) => `- ${f.stat} (Source: ${f.source}, ${f.date || "2026"}) [${f.url || ""}]`).join("\n")}
**Citations :**
${(researchData.quotes || []).map((q: any) => `- « ${q.text} » — ${q.author}, ${q.role} [${q.source_url || ""}]`).join("\n")}
**Liens d'autorité :**
${(researchData.authority_links || []).map((l: any) => `- ${l.title}: ${l.url}`).join("\n")}
**Entités :** ${(researchData.entities || []).join(", ")}
**Contexte :** ${researchData.summary || newsContext}
${trendingContext}

## MAILLAGE INTERNE OBLIGATOIRE (stratégie cocon sémantique) :
Inclure AU MOINS 3 liens internes parmi :
${linkingInstructions}
Les liens doivent être contextuels (dans le corps du texte), PAS dans un bloc séparé.
IMPORTANT : Utilise des ancres descriptives, JAMAIS "cliquez ici" ou "en savoir plus".

## SIGNAUX E-E-A-T À RENFORCER :
- Citer au moins 1 expert nommé avec son titre
- Inclure au moins 3 statistiques vérifiées avec sources
- Référencer au moins 2 études ou rapports d'autorité avec liens
- Utiliser un vocabulaire technique précis et varié (pas de répétitions)
- Mentionner des entités nommées (entreprises, outils, standards)

## CONTRAINTES DE RÉDACTION :
1. **Longueur : 4000-4600 caractères** (texte brut sans balises HTML). NON NÉGOCIABLE.
2. **Structure HTML :**
   - Un <h2> principal
   - 3-4 <h3> pour structurer
   - Des <p>, <strong>, <em>
3. **TYPOGRAPHIE FR — CASSE PHRASTIQUE OBLIGATOIRE** : le title, le slug visible, l'excerpt et tous les <h2>/<h3> doivent être en casse phrastique française : majuscule UNIQUEMENT au premier mot et aux noms propres (marques, lieux, sigles). Le "Title Case" anglais (majuscule à chaque mot) est INTERDIT en français — il dégrade le CTR et brouille la reconnaissance d'entités par les LLMs. Correct : "Comment optimiser le budget crawl en 2026". INTERDIT : "Comment Optimiser Le Budget Crawl En 2026".
4. **Bloc résumé AU DÉBUT :**
<div class="summary-card">
  <h4>📋 L'essentiel en 30 secondes</h4>
  <ul><li>4 points clés avec AU MOINS 1 chiffre vérifié et 1 mention de 2026</li></ul>
</div>
4. **Bloc impact À LA FIN :**
<div class="impact-card">
  <h4>🏢 Qu'est-ce que cela change pour mon entreprise ?</h4>
  <table><thead><tr><th>Impact</th><th>Action recommandée</th></tr></thead>
  <tbody>3 lignes impact/action</tbody></table>
</div>
5. Crawlers.fr mentionné UNE SEULE FOIS, naturellement
6. Utiliser UNIQUEMENT les chiffres des données de recherche
7. AU MOINS 3 liens <a href="URL" target="_blank" rel="noopener"> vers sources d'autorité`;

    console.log("[blog-gen v2] Step 3: Calling Gemini with tool calling...");

    const genResp = await callLovableAI({
      system: "Tu es un rédacteur SEO/GEO expert produisant du contenu factuel sourcé. Nous sommes en 2026. Renforce les signaux E-E-A-T dans chaque article.",
      user: articlePrompt,
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
                content: { type: "string", description: "Full HTML article with summary-card, impact-card, internal links, external authority links" },
                category: { type: "string", enum: ["seo", "geo", "llm", "ia"] },
                keywords: { type: "string", description: "Comma-separated keywords" },
              },
              required: ["title", "slug", "excerpt", "content", "category", "keywords"],
              additionalProperties: false,
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "publish_article" } },
    });

    let article: any;
    const toolCall = genResp.toolCalls?.[0] as any;
    if (toolCall?.function?.arguments) {
      try {
        article = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("[blog-gen v2] Failed to parse tool call arguments");
      }
    }

    if (!article) {
      const rawText = genResp.content;
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      try {
        article = JSON.parse(cleaned);
      } catch {
        console.error("[blog-gen v2] Failed to parse JSON fallback:", cleaned.slice(0, 500));
        throw new Error("Failed to parse AI response");
      }
    }

    if (!article.title || !article.slug || !article.content) {
      throw new Error("AI returned incomplete article data");
    }

    // ─── Safeguard typographique FR : casse phrastique stricte sur title + headings ───
    const originalTitle = article.title;
    article.title = toFrenchSentenceCase(article.title);
    if (article.excerpt) article.excerpt = toFrenchSentenceCase(article.excerpt);
    article.content = normalizeHtmlHeadings(article.content);
    if (originalTitle !== article.title) {
      console.log(`[blog-gen v2] Title-case normalized: "${originalTitle}" → "${article.title}"`);
    }

    // ─── STEP 4: Quality scoring (inspired by expert-audit) ───
    const qualityScore = scoreGeneratedArticle(article.content);
    console.log(`[blog-gen v2] Quality score: ${qualityScore.overall}/100 | heading=${qualityScore.heading_structure} links=${qualityScore.internal_linking} kw=${qualityScore.keyword_density} eeat=${qualityScore.eeat_signals} data=${qualityScore.data_density}`);

    if (qualityScore.issues.length > 0) {
      console.warn(`[blog-gen v2] Quality issues: ${qualityScore.issues.join(', ')}`);
    }

    // Suggest missing internal links
    const linkSuggestions = suggestInternalLinks(article.content);
    if (linkSuggestions.length > 0) {
      console.log(`[blog-gen v2] Link suggestions: ${linkSuggestions.join(' | ')}`);
    }

    const textOnly = article.content.replace(/<[^>]*>/g, "");
    const contentLength = textOnly.length;
    console.log(`[blog-gen v2] Content length: ${contentLength} chars (target: 4000-4600)`);

    // ─── STEP 5: Reject if quality too low (regeneration needed) ───
    if (qualityScore.overall < 30 || contentLength < 2000) {
      console.error(`[blog-gen v2] Quality too low (${qualityScore.overall}/100) or content too short (${contentLength}), rejecting`);
      return new Response(
        JSON.stringify({ success: false, error: "Generated content quality too low", score: qualityScore.overall, issues: qualityScore.issues }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── STEP 6: Slug dedup ───
    const { data: existing } = await supabase
      .from("blog_articles")
      .select("id")
      .eq("slug", article.slug)
      .single();

    if (existing) {
      article.slug = `${article.slug}-${new Date().toISOString().slice(0, 10)}`;
    }

    const imageUrl = pickUniqueImage(usedImages);

    // ─── STEP 7: EN + ES translations (parallel) ───
    console.log("[blog-gen v2] Step 7: Generating translations...");

    const translationPrompt = (lang: string, langLabel: string) => `You are a professional SEO translator. Translate this French blog article to ${langLabel}.

RULES:
- Keep ALL HTML structure intact
- Keep brand names unchanged
- Keep URLs unchanged
- Native-sounding translation, NOT literal
- Return ONLY a JSON object:
{"title": "Translated title < 60 chars", "excerpt": "Translated meta < 155 chars", "content": "Full translated HTML"}

FRENCH ARTICLE:
Title: ${article.title}
Excerpt: ${article.excerpt}
Content: ${article.content}`;

    const [enResp, esResp] = await Promise.all([
      callLovableAI({
        system: "Professional translator. Return only valid JSON.",
        user: translationPrompt("en", "English"),
        model: 'google/gemini-2.5-flash-lite',
      }),
      callLovableAI({
        system: "Professional translator. Return only valid JSON.",
        user: translationPrompt("es", "Spanish"),
        model: 'google/gemini-2.5-flash-lite',
      }),
    ]);

    let enArticle: any = null;
    let esArticle: any = null;

    for (const [resp, lang] of [[enResp, "en"], [esResp, "es"]] as const) {
      try {
        const raw = resp.content;
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (lang === "en") enArticle = parsed;
        else esArticle = parsed;
        console.log(`[blog-gen v2] ✅ ${lang.toUpperCase()} translation ready`);
      } catch (e) {
        console.warn(`[blog-gen v2] ⚠️ ${lang.toUpperCase()} translation error:`, e);
      }
    }

    // ─── STEP 8: Insert with quality metadata ───
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
      console.error("[blog-gen v2] Insert error:", insertErr);
      throw insertErr;
    }

    // Track tokens
    await trackTokenUsage('generate-blog-from-news', 'google/gemini-2.5-flash', genData.usage).catch(() => {});

    console.log(`[blog-gen v2] ✅ Published: ${inserted.slug} (${contentLength} chars, quality: ${qualityScore.overall}/100, EN: ${!!enArticle}, ES: ${!!esArticle})`);

    // ─── STEP 9: Ping search engines ───
    const sitemapUrl = `${supabaseUrl}/functions/v1/sitemap`;
    const pingUrls = [
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    for (const pingUrl of pingUrls) {
      try {
        const pingRes = await fetch(pingUrl, { method: "GET" });
        console.log(`[blog-gen v2] Ping ${new URL(pingUrl).hostname}: ${pingRes.status}`);
      } catch (e) {
        console.warn(`[blog-gen v2] Ping failed:`, e);
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
          qualityScore: {
            overall: qualityScore.overall,
            axes: {
              heading: qualityScore.heading_structure,
              links: qualityScore.internal_linking,
              keywords: qualityScore.keyword_density,
              eeat: qualityScore.eeat_signals,
              data: qualityScore.data_density,
              length: qualityScore.content_length,
            },
            issues: qualityScore.issues,
          },
          linkSuggestions,
          translations: { en: !!enArticle, es: !!esArticle },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[blog-gen v2] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));