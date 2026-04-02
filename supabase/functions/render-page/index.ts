import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Routes publiques indexables (pas les routes /app/*, /auth, /signup, etc.)
const PUBLIC_ROUTES: Record<string, { title: string; description: string }> = {
  "/": { title: "Crawlers.fr — Audit SEO & GEO Expert | Visibilité IA", description: "Première plateforme française d'audit hybride SEO et GEO. Analysez, corrigez et optimisez votre site pour Google et les moteurs IA." },
  "/faq": { title: "FAQ Crawlers.fr — Questions fréquentes SEO & GEO", description: "Toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency." },
  "/tarifs": { title: "Tarifs Crawlers.fr — Plans & Crédits SEO/GEO", description: "Découvrez les tarifs de Crawlers.fr : plan gratuit, crédits à l'unité et abonnement Pro Agency." },
  "/pro-agency": { title: "Pro Agency — Plan Premium SEO & GEO | Crawlers.fr", description: "Le plan Pro Agency de Crawlers.fr : audit illimité, Cocoon 3D, Content Architect, CMS Direct et maintenance prédictive." },
  "/audit-expert": { title: "Audit Expert SEO & GEO gratuit — 168 critères | Crawlers.fr", description: "Audit technique complet sur 168 critères SEO et GEO. Rapport détaillé avec plan d'action et code correctif." },
  "/audit-seo-gratuit": { title: "Audit SEO Gratuit en ligne — Analyse complète | Crawlers.fr", description: "Outil d'audit SEO gratuit : analysez votre site sur 200+ points de contrôle technique et sémantique." },
  "/analyse-site-web-gratuit": { title: "Analyse de site web gratuite — SEO & GEO | Crawlers.fr", description: "Analysez gratuitement votre site web : performance, SEO technique, données structurées et visibilité IA." },
  "/generative-engine-optimization": { title: "GEO — Generative Engine Optimization | Crawlers.fr", description: "Optimisez votre visibilité dans ChatGPT, Gemini, Perplexity et Claude avec le GEO Score de Crawlers.fr." },
  "/guide-audit-seo": { title: "Guide complet de l'audit SEO 2026 | Crawlers.fr", description: "Guide exhaustif pour réaliser un audit SEO technique et sémantique. Méthodologie, outils et bonnes pratiques." },
  "/methodologie": { title: "Méthodologie d'audit SEO & GEO — Crawlers.fr", description: "Découvrez la méthodologie d'audit SEO et GEO de Crawlers.fr : 168 critères, scoring, priorisation." },
  "/blog": { title: "Blog SEO & GEO — Actualités et guides | Crawlers.fr", description: "Articles, guides et actualités sur le SEO, le GEO, la visibilité IA et l'optimisation pour les moteurs génératifs." },
  "/lexique": { title: "Lexique SEO & GEO — Glossaire complet | Crawlers.fr", description: "Glossaire complet des termes SEO et GEO : définitions, explications et exemples pour maîtriser l'optimisation." },
  "/marina": { title: "Marina API — Rapport SEO & GEO en marque blanche | Crawlers.fr", description: "Générez des rapports SEO/GEO professionnels de 15+ pages via l'API Marina. Idéal comme lead magnet." },
  "/matrice": { title: "Matrice d'audit SEO — Grille personnalisée | Crawlers.fr", description: "Importez votre propre grille d'audit SEO et laissez Crawlers analyser chaque critère automatiquement." },
  "/content-architect": { title: "Content Architect — Création de contenu IA | Crawlers.fr", description: "Créez du contenu SEO et GEO optimisé avec l'IA. Données structurées et maillage interne automatique." },
  "/features/cocoon": { title: "Cocoon 3D — Cocon sémantique intelligent | Crawlers.fr", description: "Construisez votre architecture de contenu avec le Cocoon 3D : graphe sémantique, clusters et maillage IA." },
  "/comparatif-crawlers-semrush": { title: "Crawlers.fr vs Semrush — Comparatif SEO & GEO 2026", description: "Comparaison détaillée entre Crawlers.fr et Semrush : fonctionnalités, tarifs, GEO et avantages." },
  "/a-propos": { title: "À propos de Crawlers.fr — L'équipe et la mission", description: "Découvrez l'histoire, la mission et l'équipe derrière Crawlers.fr, la première plateforme SEO + GEO française." },
  "/sea-seo-bridge": { title: "SEA → SEO Bridge — Économies Google Ads | Crawlers.fr", description: "Identifiez les mots-clés payants capturables en SEO et calculez vos économies mensuelles potentielles." },
  "/data-flow-diagram": { title: "Architecture & flux de données — Crawlers.fr", description: "Découvrez comment Crawlers.fr protège vos données Google avec un pare-feu de données et un traitement interne." },
  "/observatoire": { title: "Observatoire SEO & GEO — Tendances 2026 | Crawlers.fr", description: "Suivez les tendances SEO et GEO en temps réel : évolution des SERP, adoption IA, métriques sectorielles." },
};

const baseUrl = "https://crawlers.fr";

/** Convert basic Markdown to HTML (headings, bold, italic, links, lists, paragraphs) */
function markdownToHtml(md: string): string {
  if (!md) return "";
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Paragraphs: wrap non-tag lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<[hulo]/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");
  return html;
}

function generateStaticHTML(route: string, meta: { title: string; description: string }): string {
  const fullUrl = `${baseUrl}${route}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Crawlers.fr">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:image" content="${baseUrl}/og-image.png">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <meta name="twitter:image" content="${baseUrl}/og-image.png">
  <link rel="alternate" hreflang="fr" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": meta.title,
    "description": meta.description,
    "url": fullUrl,
    "isPartOf": { "@type": "WebSite", "name": "Crawlers.fr", "url": baseUrl },
    "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": baseUrl, "logo": { "@type": "ImageObject", "url": `${baseUrl}/crawlers-logo-violet.png` } }
  })}</script>
</head>
<body>
  <header><nav>
    <a href="${baseUrl}">Crawlers.fr</a>
    <a href="${baseUrl}/audit-expert">Audit Expert</a>
    <a href="${baseUrl}/blog">Blog</a>
    <a href="${baseUrl}/tarifs">Tarifs</a>
    <a href="${baseUrl}/lexique">Lexique</a>
  </nav></header>
  <main>
    <h1>${meta.title}</h1>
    <p>${meta.description}</p>
    <section><h2>Navigation</h2><ul>
${Object.entries(PUBLIC_ROUTES).map(([r, m]) => `      <li><a href="${baseUrl}${r}">${m.title}</a></li>`).join("\n")}
    </ul></section>
  </main>
  <footer><p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p></footer>
</body>
</html>`;
}

function generateBlogArticleHTML(article: { slug: string; title: string; excerpt: string; content: string; image_url: string | null; published_at: string }): string {
  const fullUrl = `${baseUrl}/blog/${article.slug}`;
  const contentHtml = markdownToHtml(article.content || "");
  const safeTitle = (article.title || "").replace(/"/g, "&quot;");
  const safeExcerpt = (article.excerpt || "").replace(/"/g, "&quot;");
  const imageUrl = article.image_url || `${baseUrl}/og-image.png`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} | Crawlers.fr</title>
  <meta name="description" content="${safeExcerpt}">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Crawlers.fr">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeExcerpt}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:locale" content="fr_FR">
  <meta property="article:published_time" content="${article.published_at}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeExcerpt}">
  <meta name="twitter:image" content="${imageUrl}">
  <link rel="alternate" hreflang="fr" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.excerpt,
    "url": fullUrl,
    "image": imageUrl,
    "datePublished": article.published_at,
    "author": { "@type": "Organization", "name": "Crawlers.fr", "url": baseUrl },
    "publisher": { "@type": "Organization", "name": "Crawlers.fr", "url": baseUrl, "logo": { "@type": "ImageObject", "url": `${baseUrl}/crawlers-logo-violet.png` } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": fullUrl }
  })}</script>
</head>
<body>
  <header><nav>
    <a href="${baseUrl}">Crawlers.fr</a>
    <a href="${baseUrl}/blog">Blog</a>
    <a href="${baseUrl}/audit-expert">Audit Expert</a>
    <a href="${baseUrl}/tarifs">Tarifs</a>
  </nav></header>
  <main>
    <article>
      <h1>${article.title}</h1>
      <p><em>${safeExcerpt}</em></p>
      ${article.image_url ? `<img src="${article.image_url}" alt="${safeTitle}" loading="lazy" width="1200" height="630">` : ""}
      <div class="article-content">
        ${contentHtml}
      </div>
    </article>
    <nav aria-label="Articles du blog">
      <a href="${baseUrl}/blog">← Retour au blog</a>
    </nav>
  </main>
  <footer><p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p></footer>
</body>
</html>`;
}

// Bot user-agent detection regex — covers major search engines, social crawlers & AI bots
const BOT_UA_RE = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|applebot-extended|gptbot|oai-searchbot|chatgpt-user|google-extended|perplexitybot|claudebot|claude-user|claude-searchbot|claude-web|anthropic-ai|ccbot|bytespider|amazonbot|meta-externalagent|cohere-ai|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|screaming frog/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = url.searchParams.get("route") || "/";
    const format = url.searchParams.get("format") || "html";
    const noCache = url.searchParams.get("nocache") === "true";
    const userAgent = req.headers.get("user-agent") || "";
    const isBot = BOT_UA_RE.test(userAgent);

    if (isBot) {
      console.log(`[render-page] 🤖 Bot detected: ${userAgent.slice(0, 120)} — route: ${route}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Blog article route: /blog/<slug> ──
    const blogMatch = route.match(/^\/blog\/([a-z0-9_-]+)$/);
    if (blogMatch) {
      const slug = blogMatch[1];

      // Check cache first
      if (!noCache) {
        const { data: cached } = await supabase
          .from("prerender_cache")
          .select("html_content, meta_title, meta_description, rendered_at")
          .eq("route", route)
          .gt("expires_at", new Date().toISOString())
          .single();

        if (cached) {
          if (format === "json") {
            return new Response(JSON.stringify({ route, title: cached.meta_title, description: cached.meta_description, rendered_at: cached.rendered_at, cached: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(cached.html_content, {
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Prerender": "cache-hit", "X-Rendered-At": cached.rendered_at },
          });
        }
      }

      // Fetch article from DB
      const { data: article, error } = await supabase
        .from("blog_articles")
        .select("slug, title, excerpt, content, image_url, published_at")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (error || !article) {
        return new Response(JSON.stringify({ error: "Article not found", slug }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = generateBlogArticleHTML(article);

      // Cache it (24h)
      const contentHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html))
        .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

      await supabase.from("prerender_cache").upsert({
        route,
        html_content: html,
        content_hash: contentHash,
        meta_title: article.title,
        meta_description: article.excerpt || "",
        rendered_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "route" });

      if (format === "json") {
        return new Response(JSON.stringify({ route, title: article.title, description: article.excerpt, rendered_at: new Date().toISOString(), cached: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Prerender": "fresh" },
      });
    }

    // ── Static routes ──
    const meta = PUBLIC_ROUTES[route];
    if (!meta) {
      return new Response(
        JSON.stringify({ error: "Route not found", available_routes: [...Object.keys(PUBLIC_ROUTES), "/blog/<slug>"] }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    if (!noCache) {
      const { data: cached } = await supabase
        .from("prerender_cache")
        .select("html_content, meta_title, meta_description, rendered_at")
        .eq("route", route)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        if (format === "json") {
          return new Response(JSON.stringify({ route, title: cached.meta_title, description: cached.meta_description, rendered_at: cached.rendered_at, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(cached.html_content, {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Prerender": "cache-hit", "X-Rendered-At": cached.rendered_at },
        });
      }
    }

    const html = generateStaticHTML(route, meta);
    const contentHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html))
      .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

    await supabase.from("prerender_cache").upsert({
      route,
      html_content: html,
      content_hash: contentHash,
      meta_title: meta.title,
      meta_description: meta.description,
      rendered_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "route" });

    if (format === "json") {
      return new Response(JSON.stringify({ route, title: meta.title, description: meta.description, rendered_at: new Date().toISOString(), cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Prerender": "fresh" },
    });
  } catch (error) {
    console.error("render-page error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
