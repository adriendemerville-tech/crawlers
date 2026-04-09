import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Routes publiques indexables
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
  "/conversion-optimizer": { title: "Conversion Optimizer — Audit UX/CRO par IA | Crawlers.fr", description: "Audit UX/CRO contextuel sur 7 axes : ton, CTA, alignement, lisibilité, conversion, mobile, mots-clés. Capture annotée." },
  "/analyse-logs": { title: "Analyse de Logs Serveur — Crawl Google & IA | Crawlers.fr", description: "Analysez vos logs serveur : 40+ bots détectés, budget crawl, pages orphelines, monitoring continu via Cloudflare." },
  "/eeat": { title: "Audit E-E-A-T — Scoring pondéré sur 100 | Crawlers.fr", description: "Évaluation complète des signaux E-E-A-T evidence-based avec scoring pondéré et pénalités automatiques." },
  "/analyse-bots-ia": { title: "Analyse Bots IA — GPTBot, ClaudeBot, Google-Extended | Crawlers.fr", description: "Vérifiez l'accès des bots IA à votre site et optimisez votre robots.txt pour la visibilité LLM." },
  "/score-geo": { title: "Score GEO — Optimisation moteurs IA | Crawlers.fr", description: "Note 0-100 mesurant votre optimisation pour ChatGPT, Gemini, Perplexity et les moteurs IA génératifs." },
  "/visibilite-llm": { title: "Visibilité LLM — Présence dans les IA | Crawlers.fr", description: "Mesurez votre présence dans ChatGPT, Gemini, Perplexity, Claude et Grok sur vos mots-clés cibles." },
  "/pagespeed": { title: "PageSpeed — Core Web Vitals | Crawlers.fr", description: "Analyse Core Web Vitals (LCP, FID, CLS, TTFB) mobile et desktop via Google PageSpeed Insights." },
  "/comparatif-claude-code-vs-crawlers": { title: "Claude Code vs Crawlers — Comparatif SEO | Crawlers.fr", description: "Comparaison Claude Code vs Crawlers.fr pour l'audit et l'optimisation SEO/GEO." },
  "/aide": { title: "Centre d'aide Crawlers.fr — Documentation SEO, GEO & IA", description: "Documentation complète de la plateforme : audits, scores, crédits, intégrations et assistants IA." },
};

const baseUrl = "https://crawlers.fr";

const PUBLISHER_ORG = {
  "@type": "Organization",
  "name": "Crawlers.fr",
  "url": baseUrl,
  "logo": { "@type": "ImageObject", "url": `${baseUrl}/crawlers-logo-violet.png`, "width": 512, "height": 512 },
  "sameAs": ["https://www.linkedin.com/company/crawlers-fr"]
};

const AUTHOR_PERSON = {
  "@type": "Person",
  "name": "Équipe Crawlers.fr",
  "url": `${baseUrl}/a-propos`,
  "worksFor": { "@type": "Organization", "name": "Crawlers.fr" }
};

// ── Helpers ──

function escapeHtml(str: string): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Convert Markdown table to HTML <table> */
function markdownTableToHtml(tableBlock: string): string {
  const lines = tableBlock.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return `<p>${escapeHtml(tableBlock)}</p>`;

  // Check if line 2 is separator (|---|---|)
  const isSeparator = /^\|?[\s-:|]+\|/.test(lines[1]);
  if (!isSeparator) return `<p>${escapeHtml(tableBlock)}</p>`;

  const parseRow = (line: string): string[] =>
    line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);

  const headers = parseRow(lines[0]);
  const dataLines = lines.slice(2);

  let html = `<table>\n<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>\n<tbody>\n`;
  for (const line of dataLines) {
    const cells = parseRow(line);
    html += `<tr>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>\n`;
  }
  html += `</tbody>\n</table>`;
  return html;
}

/** Convert basic Markdown to HTML (headings, bold, italic, links, lists, tables, paragraphs) */
function markdownToHtml(md: string): string {
  if (!md) return "";

  // First, extract and convert tables
  const tableRegex = /((?:^\|.+\|$\n?){2,})/gm;
  let processed = md.replace(tableRegex, (match) => {
    return `\n%%TABLE_START%%${markdownTableToHtml(match)}%%TABLE_END%%\n`;
  });

  let html = processed
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<[hulo]/.test(trimmed)) return trimmed;
      if (trimmed.includes("%%TABLE_START%%")) return trimmed.replace(/%%TABLE_START%%/g, "").replace(/%%TABLE_END%%/g, "");
      return `<p>${trimmed}</p>`;
    })
    .join("\n");
  // Clean any remaining markers
  html = html.replace(/%%TABLE_START%%/g, "").replace(/%%TABLE_END%%/g, "");
  return html;
}

/** Count words in text (strip markdown/html) */
function countWords(text: string): number {
  if (!text) return 0;
  const plain = text.replace(/<[^>]+>/g, "").replace(/[#*_\[\]()]/g, "").trim();
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Extract FAQ pairs from markdown content (## or ### starting with question words) */
function extractFaqFromContent(content: string): Array<{ question: string; answer: string }> {
  if (!content) return [];
  const faqs: Array<{ question: string; answer: string }> = [];
  const lines = content.split("\n");
  const questionRe = /^#{2,3}\s+(.+\?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(questionRe);
    if (match) {
      const question = match[1].trim();
      const answerLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,3}\s/.test(lines[j])) break;
        const line = lines[j].trim();
        if (line) answerLines.push(line);
      }
      if (answerLines.length > 0) {
        const answer = answerLines
          .join(" ")
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .slice(0, 500);
        faqs.push({ question, answer });
      }
    }
  }
  return faqs.slice(0, 10);
}

/** Extract tables from markdown content as plain text for llms.txt */
function extractTablesAsText(content: string): string[] {
  if (!content) return [];
  const tables: string[] = [];
  const tableRegex = /((?:^\|.+\|$\n?){2,})/gm;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push(match[1].trim());
  }
  return tables;
}

/** Generate BreadcrumbList JSON-LD */
function breadcrumbJsonLd(crumbs: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "item": c.url,
    })),
  };
}

/** Generate FAQPage JSON-LD */
function faqJsonLd(faqs: Array<{ question: string; answer: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer },
    })),
  };
}

// ── Informational section generators (neutral, no CTA) ──

/** Generate a neutral informational section with external sources for SEO/GEO context */
function generateInfoSection(route: string): string {
  const sections: Record<string, string> = {
    "/tarifs": `<section aria-label="Contexte tarifaire">
      <h2>Comprendre les modèles de tarification des outils SEO</h2>
      <p>Les outils d'audit SEO adoptent généralement trois modèles : l'abonnement mensuel, le paiement à l'usage (crédits) ou le modèle freemium. Selon une <a href="https://www.gartner.com/en/marketing" rel="noopener">étude Gartner</a>, 68 % des PME préfèrent les modèles à la consommation pour maîtriser leurs coûts.</p>
      <p>Le marché français des outils SEO est estimé à plus de 200 millions d'euros en 2026. Les tarifs varient de 0 € (outils basiques) à plus de 500 €/mois pour les solutions enterprise. Pour comparer les offres, le <a href="https://www.journaldunet.com/solutions/seo-referencement/">Journal du Net</a> publie régulièrement des comparatifs.</p>
      <p>Ressources : <a href="${baseUrl}/methodologie">Méthodologie d'audit Crawlers.fr</a> · <a href="${baseUrl}/lexique">Lexique SEO & GEO</a> · <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide" rel="noopener">Google SEO Starter Guide</a></p>
    </section>`,
    "/audit-expert": `<section aria-label="Contexte audit SEO">
      <h2>Qu'est-ce qu'un audit SEO technique ?</h2>
      <p>Un audit SEO technique consiste à analyser l'infrastructure d'un site web pour identifier les facteurs bloquant son référencement naturel. Selon <a href="https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers" rel="noopener">Google Search Central</a>, les problèmes d'indexation représentent la première cause de perte de visibilité.</p>
      <p>Les critères standards incluent : la vitesse de chargement (<a href="https://web.dev/vitals/" rel="noopener">Core Web Vitals</a>), l'accessibilité mobile, les données structurées (<a href="https://schema.org/" rel="noopener">Schema.org</a>), la configuration du robots.txt et du sitemap XML.</p>
      <p>Pour approfondir : <a href="${baseUrl}/guide-audit-seo">Guide complet de l'audit SEO</a> · <a href="${baseUrl}/methodologie">Méthodologie 168 critères</a> · <a href="https://search.google.com/search-console/about" rel="noopener">Google Search Console</a></p>
    </section>`,
    "/generative-engine-optimization": `<section aria-label="Contexte GEO">
      <h2>Le GEO : une discipline émergente</h2>
      <p>Le Generative Engine Optimization (GEO) désigne l'ensemble des techniques visant à améliorer la visibilité d'un site dans les réponses des moteurs IA génératifs comme ChatGPT, Gemini ou Perplexity. Le terme a été formalisé par des chercheurs de <a href="https://arxiv.org/abs/2311.09735" rel="noopener">Princeton et Georgia Tech (2023)</a>.</p>
      <p>Contrairement au SEO classique, le GEO repose sur la citation des sources, la qualité des données structurées et la présence dans les corpus d'entraînement des LLMs. Le fichier <code>llms.txt</code> est un standard émergent pour guider les agents IA.</p>
      <p>Lectures complémentaires : <a href="${baseUrl}/lexique">Lexique SEO & GEO</a> · <a href="${baseUrl}/blog">Blog Crawlers.fr</a> · <a href="https://llmstxt.org/" rel="noopener">llmstxt.org — Standard llms.txt</a></p>
    </section>`,
    "/pro-agency": `<section aria-label="Contexte agences SEO">
      <h2>L'évolution du métier d'agence SEO en 2026</h2>
      <p>Les agences SEO font face à une double transformation : l'essor de l'IA générative dans les SERP et l'exigence croissante de ROI mesurable. D'après le <a href="https://www.semrush.com/blog/state-of-search/" rel="noopener">State of Search 2025 de Semrush</a>, 47 % des agences intègrent désormais l'optimisation GEO dans leurs prestations.</p>
      <p>Les fonctionnalités clés pour les agences incluent : le suivi multi-sites, les rapports en marque blanche, la connexion CMS directe et la maintenance prédictive automatisée.</p>
      <p>Pour en savoir plus : <a href="${baseUrl}/tarifs">Grille tarifaire complète</a> · <a href="${baseUrl}/marina">Marina API — rapports en marque blanche</a> · <a href="https://www.abondance.com/" rel="noopener">Abondance.com — Actualités SEO</a></p>
    </section>`,
    "/features/cocoon": `<section aria-label="Contexte cocon sémantique">
      <h2>Le cocon sémantique en SEO</h2>
      <p>Le concept de cocon sémantique, popularisé par Laurent Bourrelly, structure le contenu d'un site en clusters thématiques reliés par un maillage interne hiérarchique (pages mères → pages filles). Cette architecture améliore la compréhension thématique par les moteurs de recherche.</p>
      <p>Des études de <a href="https://moz.com/learn/seo/internal-link" rel="noopener">Moz</a> montrent que le maillage interne reste l'un des leviers SEO les plus sous-exploités. Un cocon bien structuré peut augmenter le trafic organique de 30 à 50 % sur les thématiques ciblées.</p>
      <p>Ressources : <a href="${baseUrl}/lexique">Définition dans le lexique</a> · <a href="${baseUrl}/methodologie">Méthodologie d'audit</a> · <a href="https://ahrefs.com/blog/internal-links-for-seo/" rel="noopener">Ahrefs — Internal Links for SEO</a></p>
    </section>`,
    "/comparatif-crawlers-semrush": `<section aria-label="Contexte marché outils SEO">
      <h2>Le marché des outils SEO en France</h2>
      <p>Le marché français compte plus de 30 solutions professionnelles d'audit SEO. Les critères de choix principaux sont : la couverture de critères, le rapport qualité-prix, le support francophone et la prise en compte des évolutions (Core Web Vitals, IA générative).</p>
      <p>Selon <a href="https://www.statista.com/outlook/tmo/digital-advertising/search-advertising/france" rel="noopener">Statista</a>, le search advertising en France pèse 5,2 milliards d'euros en 2026, rendant l'optimisation SEO d'autant plus stratégique.</p>
      <p>Comparatifs tiers : <a href="https://www.blogdumoderateur.com/" rel="noopener">Blog du Modérateur</a> · <a href="https://www.leptidigital.fr/" rel="noopener">Leptidigital</a></p>
    </section>`,
  };

  // Default informational section for pages not specifically covered
  const defaultSection = `<section aria-label="Ressources complémentaires">
    <h2>Ressources et références</h2>
    <p>Pour approfondir les sujets abordés sur cette page :</p>
    <ul>
      <li><a href="https://developers.google.com/search/docs" rel="noopener">Documentation Google Search Central</a> — Guide officiel du référencement</li>
      <li><a href="https://schema.org/" rel="noopener">Schema.org</a> — Référentiel des données structurées</li>
      <li><a href="https://web.dev/vitals/" rel="noopener">Web Vitals</a> — Métriques de performance web par Google</li>
      <li><a href="${baseUrl}/lexique">Lexique SEO & GEO Crawlers.fr</a> — 150+ définitions</li>
      <li><a href="${baseUrl}/blog">Blog Crawlers.fr</a> — Articles et guides pratiques</li>
    </ul>
  </section>`;

  return sections[route] || defaultSection;
}

/** Generate pricing table as static HTML */
function generatePricingTableHtml(): string {
  return `<section aria-label="Grille tarifaire">
    <h2>Barème tarifaire Crawlers.fr</h2>
    <table>
      <thead>
        <tr><th>Plan</th><th>Prix</th><th>Fonctionnalités incluses</th></tr>
      </thead>
      <tbody>
        <tr><td>Gratuit</td><td>0 €</td><td>Bots IA, Score GEO, Visibilité LLM, PageSpeed, Audit Expert (inscription), Matrice d'audit</td></tr>
        <tr><td>Crédits à l'unité</td><td>0,90 € / crédit</td><td>Crawl multi-pages, Audit comparé, Marina API, fonctions premium à la demande</td></tr>
        <tr><td>Pro Agency</td><td>29 € / mois</td><td>Tout illimité, Cocoon 3D, Content Architect, CMS Direct, GSC/GA4, GMB, Autopilote Parménion</td></tr>
        <tr><td>Pro Agency+</td><td>79 € / mois</td><td>Pro Agency + crawl 50 000 pages, API Marina illimitée, support prioritaire</td></tr>
      </tbody>
    </table>
    <p><small>Tarifs en vigueur au 1er avril 2026, HT. Pas d'engagement, résiliation à tout moment.</small></p>
  </section>`;
}

// ── Route-specific breadcrumb labels ──
const ROUTE_LABELS: Record<string, string> = {
  "/": "Accueil",
  "/faq": "FAQ",
  "/tarifs": "Tarifs",
  "/pro-agency": "Pro Agency",
  "/audit-expert": "Audit Expert",
  "/audit-seo-gratuit": "Audit SEO Gratuit",
  "/analyse-site-web-gratuit": "Analyse de site web",
  "/generative-engine-optimization": "GEO",
  "/guide-audit-seo": "Guide Audit SEO",
  "/methodologie": "Méthodologie",
  "/blog": "Blog",
  "/lexique": "Lexique",
  "/marina": "Marina API",
  "/matrice": "Matrice d'audit",
  "/content-architect": "Content Architect",
  "/features/cocoon": "Cocoon 3D",
  "/comparatif-crawlers-semrush": "Crawlers vs Semrush",
  "/a-propos": "À propos",
  "/sea-seo-bridge": "SEA → SEO Bridge",
  "/data-flow-diagram": "Architecture données",
  "/observatoire": "Observatoire",
};

// ── Routes that should include the pricing table ──
const ROUTES_WITH_PRICING = ["/tarifs", "/pro-agency", "/comparatif-crawlers-semrush", "/"];

// ── HTML generators ──

function generateStaticHTML(route: string, meta: { title: string; description: string }): string {
  const fullUrl = `${baseUrl}${route}`;
  const label = ROUTE_LABELS[route] || meta.title;

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", url: baseUrl },
    ...(route !== "/" ? [{ name: label, url: fullUrl }] : []),
  ]);

  const webPage = {
    "@context": "https://schema.org",
    "@type": route === "/" ? "WebSite" : "WebPage",
    "name": meta.title,
    "description": meta.description,
    "url": fullUrl,
    ...(route === "/" ? { "potentialAction": { "@type": "SearchAction", "target": `${baseUrl}/audit-expert?url={search_term_string}`, "query-input": "required name=search_term_string" } } : {}),
    "isPartOf": { "@type": "WebSite", "name": "Crawlers.fr", "url": baseUrl },
    "publisher": PUBLISHER_ORG,
  };

  const pricingHtml = ROUTES_WITH_PRICING.includes(route) ? generatePricingTableHtml() : "";
  const infoHtml = generateInfoSection(route);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <link rel="canonical" href="${fullUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Crawlers.fr">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:image" content="${baseUrl}/og-image.png">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  <meta name="twitter:image" content="${baseUrl}/og-image.png">
  <link rel="alternate" hreflang="fr" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">
  <script type="application/ld+json">${JSON.stringify(webPage)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
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
    <h1>${escapeHtml(meta.title)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${pricingHtml}
    ${infoHtml}
    <section><h2>Navigation</h2><ul>
${Object.entries(PUBLIC_ROUTES).map(([r, m]) => `      <li><a href="${baseUrl}${r}">${escapeHtml(m.title)}</a></li>`).join("\n")}
    </ul></section>
  </main>
  <footer><p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p></footer>
</body>
</html>`;
}

function generateBlogArticleHTML(article: { slug: string; title: string; excerpt: string; content: string; image_url: string | null; published_at: string; updated_at?: string }): string {
  const fullUrl = `${baseUrl}/blog/${article.slug}`;
  const contentHtml = markdownToHtml(article.content || "");
  const safeTitle = escapeHtml(article.title);
  const safeExcerpt = escapeHtml(article.excerpt);
  const imageUrl = article.image_url || `${baseUrl}/og-image.png`;
  const wordCount = countWords(article.content || "");
  const dateModified = article.updated_at || article.published_at;

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", url: baseUrl },
    { name: "Blog", url: `${baseUrl}/blog` },
    { name: article.title, url: fullUrl },
  ]);

  const blogPosting: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.excerpt,
    "url": fullUrl,
    "image": imageUrl,
    "datePublished": article.published_at,
    "dateModified": dateModified,
    "wordCount": wordCount,
    "inLanguage": "fr",
    "author": AUTHOR_PERSON,
    "publisher": PUBLISHER_ORG,
    "mainEntityOfPage": { "@type": "WebPage", "@id": fullUrl },
    "isPartOf": { "@type": "Blog", "name": "Blog Crawlers.fr", "url": `${baseUrl}/blog` },
  };

  const faqs = extractFaqFromContent(article.content || "");

  let jsonLdScripts = `
  <script type="application/ld+json">${JSON.stringify(blogPosting)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;

  if (faqs.length >= 2) {
    jsonLdScripts += `\n  <script type="application/ld+json">${JSON.stringify(faqJsonLd(faqs))}</script>`;
  }

  // Generate neutral informational footer for blog articles
  const articleInfoSection = `<section aria-label="Ressources complémentaires">
      <h2>Pour aller plus loin</h2>
      <ul>
        <li><a href="https://developers.google.com/search/docs" rel="noopener">Google Search Central</a> — Documentation officielle SEO</li>
        <li><a href="https://schema.org/" rel="noopener">Schema.org</a> — Référentiel des données structurées</li>
        <li><a href="https://web.dev/vitals/" rel="noopener">Web Vitals</a> — Métriques de performance Google</li>
        <li><a href="https://llmstxt.org/" rel="noopener">llmstxt.org</a> — Standard llms.txt pour l'IA</li>
        <li><a href="${baseUrl}/lexique">Lexique SEO & GEO</a> — 150+ termes définis</li>
        <li><a href="${baseUrl}/guide-audit-seo">Guide complet de l'audit SEO</a></li>
        <li><a href="${baseUrl}/generative-engine-optimization">Comprendre le GEO</a></li>
      </ul>
    </section>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} | Crawlers.fr</title>
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
  <meta property="article:modified_time" content="${dateModified}">
  <meta property="article:author" content="${baseUrl}/a-propos">
  <meta property="article:section" content="SEO & GEO">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeExcerpt}">
  <meta name="twitter:image" content="${imageUrl}">
  <link rel="alternate" hreflang="fr" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">${jsonLdScripts}
</head>
<body>
  <header><nav>
    <a href="${baseUrl}">Crawlers.fr</a>
    <a href="${baseUrl}/blog">Blog</a>
    <a href="${baseUrl}/audit-expert">Audit Expert</a>
    <a href="${baseUrl}/tarifs">Tarifs</a>
  </nav></header>
  <main>
    <nav aria-label="Fil d'Ariane">
      <ol>
        <li><a href="${baseUrl}">Accueil</a></li>
        <li><a href="${baseUrl}/blog">Blog</a></li>
        <li>${safeTitle}</li>
      </ol>
    </nav>
    <article>
      <h1>${safeTitle}</h1>
      <p><em>${safeExcerpt}</em></p>
      <p><time datetime="${article.published_at}">Publié le ${new Date(article.published_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</time>${dateModified !== article.published_at ? ` · <time datetime="${dateModified}">Mis à jour le ${new Date(dateModified).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</time>` : ""}</p>
      ${article.image_url ? `<img src="${article.image_url}" alt="${safeTitle}" loading="lazy" width="1200" height="630">` : ""}
      <div class="article-content">
        ${contentHtml}
      </div>
    </article>
    ${articleInfoSection}
    <nav aria-label="Articles du blog">
      <a href="${baseUrl}/blog">← Retour au blog</a>
    </nav>
  </main>
  <footer><p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p></footer>
</body>
</html>`;
}

// Bot user-agent detection regex
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

      const { data: article, error } = await supabase
        .from("blog_articles")
        .select("slug, title, excerpt, content, image_url, published_at, updated_at")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (error || !article) {
        return new Response(JSON.stringify({ error: "Article not found", slug }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = generateBlogArticleHTML(article);

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

    // ── Landing page route: /landing/<slug> ──
    const landingMatch = route.match(/^\/landing\/([a-z0-9_-]+)$/);
    if (landingMatch) {
      const slug = landingMatch[1];

      const { data: landing, error: landingError } = await supabase
        .from("seo_page_drafts")
        .select("title, slug, meta_title, meta_description, content, target_keyword, published_at")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("page_type", "landing")
        .single();

      if (landingError || !landing) {
        return new Response(JSON.stringify({ error: "Landing not found", slug }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullUrl = `${baseUrl}/landing/${landing.slug}`;
      const contentHtml = markdownToHtml(landing.content || '');
      
      // Extract any tables from content for enhanced rendering
      const landingInfoSection = `<section aria-label="Ressources complémentaires">
        <h2>Ressources et références</h2>
        <ul>
          <li><a href="https://developers.google.com/search/docs" rel="noopener">Google Search Central</a></li>
          <li><a href="https://schema.org/" rel="noopener">Schema.org — Données structurées</a></li>
          <li><a href="${baseUrl}/lexique">Lexique SEO & GEO</a></li>
          <li><a href="${baseUrl}/blog">Blog Crawlers.fr</a></li>
          <li><a href="${baseUrl}/guide-audit-seo">Guide complet de l'audit SEO</a></li>
        </ul>
      </section>`;

      // Detect FAQ in landing content
      const landingFaqs = extractFaqFromContent(landing.content || "");
      let landingJsonLd = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": landing.title,
        "description": landing.meta_description || "",
        "url": fullUrl,
        "publisher": PUBLISHER_ORG,
        ...(landing.published_at ? { "datePublished": landing.published_at } : {}),
      })}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd([
        { name: "Accueil", url: baseUrl },
        { name: landing.title, url: fullUrl },
      ]))}</script>`;

      if (landingFaqs.length >= 2) {
        landingJsonLd += `\n  <script type="application/ld+json">${JSON.stringify(faqJsonLd(landingFaqs))}</script>`;
      }

      const landingHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(landing.meta_title || landing.title)}</title>
  <meta name="description" content="${escapeHtml(landing.meta_description || '')}">
  <link rel="canonical" href="${fullUrl}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${escapeHtml(landing.meta_title || landing.title)}">
  <meta property="og:description" content="${escapeHtml(landing.meta_description || '')}">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Crawlers.fr">
  <meta property="og:image" content="${baseUrl}/og-image.png">
  <meta property="og:locale" content="fr_FR">
  <link rel="alternate" hreflang="fr" href="${fullUrl}">
  <link rel="alternate" hreflang="x-default" href="${fullUrl}">
  ${landingJsonLd}
</head>
<body>
  <header><nav>
    <a href="${baseUrl}">Crawlers.fr</a>
    <a href="${baseUrl}/audit-expert">Audit Expert</a>
    <a href="${baseUrl}/blog">Blog</a>
    <a href="${baseUrl}/tarifs">Tarifs</a>
  </nav></header>
  <main>
    <nav aria-label="Fil d'Ariane">
      <ol>
        <li><a href="${baseUrl}">Accueil</a></li>
        <li>${escapeHtml(landing.title)}</li>
      </ol>
    </nav>
    <article>
      <h1>${escapeHtml(landing.title)}</h1>
      ${contentHtml}
    </article>
    ${landingInfoSection}
  </main>
  <footer><p>© 2026 Crawlers.fr — Plateforme d'audit SEO & GEO</p></footer>
</body>
</html>`;

      await supabase.from("prerender_cache").upsert({
        route,
        html_content: landingHtml,
        content_hash: "",
        meta_title: landing.meta_title || landing.title,
        meta_description: landing.meta_description || "",
        rendered_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "route" });

      if (format === "json") {
        return new Response(JSON.stringify({ route, title: landing.title, description: landing.meta_description }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(landingHtml, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Prerender": "fresh" },
      });
    }

    // ── Static routes ──
    const meta = PUBLIC_ROUTES[route];
    if (!meta) {
      return new Response(
        JSON.stringify({ error: "Route not found", available_routes: [...Object.keys(PUBLIC_ROUTES), "/blog/<slug>", "/landing/<slug>"] }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
