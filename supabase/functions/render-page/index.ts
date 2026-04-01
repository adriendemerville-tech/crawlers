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

function generateStaticHTML(route: string, meta: { title: string; description: string }, llmsTxt: string): string {
  const baseUrl = "https://crawlers.fr";
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
  <link rel="alternate" hreflang="en" href="${fullUrl}">
  <link rel="alternate" hreflang="es" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": meta.title,
    "description": meta.description,
    "url": fullUrl,
    "isPartOf": {
      "@type": "WebSite",
      "name": "Crawlers.fr",
      "url": baseUrl,
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${baseUrl}/audit-expert?url={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "Crawlers.fr",
      "url": baseUrl,
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/crawlers-logo-violet.png` }
    }
  })}</script>
</head>
<body>
  <header>
    <nav>
      <a href="${baseUrl}">Crawlers.fr</a>
      <a href="${baseUrl}/audit-expert">Audit Expert</a>
      <a href="${baseUrl}/faq">FAQ</a>
      <a href="${baseUrl}/tarifs">Tarifs</a>
      <a href="${baseUrl}/pro-agency">Pro Agency</a>
      <a href="${baseUrl}/blog">Blog</a>
      <a href="${baseUrl}/lexique">Lexique</a>
    </nav>
  </header>
  <main>
    <h1>${meta.title}</h1>
    <p>${meta.description}</p>
    <section>
      <h2>À propos de Crawlers.fr</h2>
      <p>Crawlers.fr est la première plateforme française d'audit hybride SEO et GEO. Elle combine diagnostic technique, correction automatique et optimisation pour les moteurs de recherche traditionnels ET les moteurs de réponse IA (ChatGPT, Gemini, Perplexity, Claude).</p>
    </section>
    <section>
      <h2>Fonctionnalités principales</h2>
      <ul>
        <li>Audit Expert sur 168 critères SEO et GEO</li>
        <li>Score GEO — Visibilité dans les moteurs IA</li>
        <li>Cocoon 3D — Architecture sémantique intelligente</li>
        <li>Content Architect — Création de contenu IA</li>
        <li>Matrice d'audit personnalisable</li>
        <li>Marina API — Rapports en marque blanche</li>
        <li>Connexion CMS directe (WordPress, Shopify, etc.)</li>
        <li>Autopilote Parménion — Maintenance prédictive</li>
      </ul>
    </section>
    <section>
      <h2>Navigation</h2>
      <ul>
${Object.entries(PUBLIC_ROUTES).map(([r, m]) => `        <li><a href="${baseUrl}${r}">${m.title}</a></li>`).join('\n')}
      </ul>
    </section>
  </main>
  <footer>
    <p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p>
    <nav>
      <a href="${baseUrl}/mentions-legales">Mentions légales</a>
      <a href="${baseUrl}/politique-confidentialite">Politique de confidentialité</a>
      <a href="${baseUrl}/cgvu">CGVU</a>
    </nav>
  </footer>
  <!-- Full documentation: ${baseUrl}/llms.txt -->
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = url.searchParams.get("route") || "/";
    const format = url.searchParams.get("format") || "html"; // html or json
    const noCache = url.searchParams.get("nocache") === "true";

    // Validate route
    const meta = PUBLIC_ROUTES[route];
    if (!meta) {
      return new Response(
        JSON.stringify({ 
          error: "Route not found", 
          available_routes: Object.keys(PUBLIC_ROUTES) 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
          return new Response(JSON.stringify({
            route,
            title: cached.meta_title,
            description: cached.meta_description,
            rendered_at: cached.rendered_at,
            cached: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(cached.html_content, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "X-Prerender": "cache-hit",
            "X-Rendered-At": cached.rendered_at,
          },
        });
      }
    }

    // Generate static HTML
    const html = generateStaticHTML(route, meta, "");
    const contentHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(html)
    ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Cache it
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
      return new Response(JSON.stringify({
        route,
        title: meta.title,
        description: meta.description,
        rendered_at: new Date().toISOString(),
        cached: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Prerender": "fresh",
        "X-Rendered-At": new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("render-page error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
