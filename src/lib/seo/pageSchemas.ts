/**
 * JSON-LD des pages statiques, rendu côté serveur via `pageHead({ jsonLd })`.
 *
 * Ces schémas vivaient dans les composants React (react-helmet-async) : ils
 * n'apparaissaient donc pas dans le HTML servi. Les déplacer ici garantit
 * qu'ils sont présents pour Google et les moteurs génératifs dès la première
 * réponse HTTP.
 */

import { SITE_URL } from '@/lib/seo/pageHead';

const ORG = { '@type': 'Organization', name: 'Crawlers.fr', url: SITE_URL };
const SITE = { '@type': 'WebSite', name: 'Crawlers.fr', url: SITE_URL };

function faqPage(items: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

function breadcrumb(trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/* ── /faq ─────────────────────────────────────────────────────────────── */

export const FAQ_ITEMS = [
  {
    q: "Qu'est-ce que Crawlers.fr ?",
    a: "Crawlers.fr est une plateforme francophone qui combine audit SEO technique, GEO Score, mesure de visibilité dans les LLM et génération de correctifs actionnables dans un seul outil. Elle s'adresse aux agences SEO, aux freelances et aux PME.",
  },
  {
    q: 'Quelle est la différence entre SEO et GEO ?',
    a: "Le SEO optimise la visibilité sur les moteurs de recherche traditionnels comme Google. Le GEO (Generative Engine Optimization) optimise la visibilité dans les moteurs de réponse IA comme ChatGPT, Perplexity et Gemini. Crawlers.fr couvre les deux simultanément.",
  },
  {
    q: 'Crawlers.fr est-il gratuit ?',
    a: "Partiellement. Les outils Bots IA, Score GEO, Visibilité LLM et PageSpeed sont gratuits sans inscription. L'audit technique SEO est gratuit avec inscription. Le plan Pro Agency est payant.",
  },
  {
    q: 'Crawlers.fr est-il un simple wrapper GPT ?',
    a: "Non. La plateforme repose sur une infrastructure serverless de plusieurs centaines de milliers de lignes de code, 7 algorithmes propriétaires, un système multi-fallback sur les API critiques et une architecture RGPD native.",
  },
  {
    q: 'Quels LLM Crawlers.fr interroge-t-il ?',
    a: 'Crawlers.fr interroge ChatGPT, Gemini, Perplexity et Claude pour calculer le score de visibilité LLM et la part de voix dans les moteurs de réponse IA.',
  },
  {
    q: "Comment Crawlers.fr mesure-t-il la citabilité d'une page ?",
    a: "La citabilité est mesurée sur des critères vérifiables : présence de passages autoportants, densité factuelle, données structurées valides, accessibilité aux crawlers IA dans robots.txt et cohérence de la carte d'identité du site. Chaque critère est calculé, jamais estimé.",
  },
] as const;

export const faqPageJsonLd = faqPage(FAQ_ITEMS.map((i) => ({ q: i.q, a: i.a })));

/* ── /aide ────────────────────────────────────────────────────────────── */

export const aideJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  name: 'Documentation Crawlers.fr',
  headline: 'Documentation Crawlers.fr — audits SEO, GEO et visibilité IA',
  description:
    'Base de connaissance de la plateforme Crawlers.fr : audits SEO, GEO Score, visibilité LLM, cocon sémantique et correctifs actionnables.',
  url: `${SITE_URL}/aide`,
  inLanguage: 'fr-FR',
  publisher: ORG,
  isPartOf: SITE,
  breadcrumb: breadcrumb([
    { name: 'Accueil', path: '' },
    { name: 'Centre d’aide', path: '/aide' },
  ]),
};

/* ── /audit-expert ────────────────────────────────────────────────────── */

export const auditExpertJsonLd = [
  faqPage([
    {
      q: "Que contient l'audit expert SEO et GEO ?",
      a: "L'audit expert couvre la santé technique (indexabilité, Core Web Vitals, statuts HTTP, liens cassés), la structure sémantique, les données structurées et la citabilité par les moteurs génératifs. Il produit un plan d'action priorisé et le code correctif associé.",
    },
    {
      q: "Combien de temps prend l'audit ?",
      a: "Un check-up d'URL prend environ deux minutes. Un audit multi-pages dépend du nombre d'URL à explorer et s'exécute en file d'attente, avec restitution dans la console.",
    },
    {
      q: "L'audit expert remplace-t-il un consultant SEO ?",
      a: "Non. Il fournit les constats mesurés, les causes racines et les correctifs, ce qui supprime la phase de collecte manuelle. L'arbitrage stratégique et la mise en œuvre éditoriale restent humains.",
    },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Audit SEO & GEO expert',
    description:
      'Audit SEO et GEO expert : Core Web Vitals, citabilité ChatGPT/Claude/Perplexity, données structurées et code correctif.',
    url: `${SITE_URL}/audit-expert`,
    inLanguage: 'fr-FR',
    isPartOf: SITE,
    breadcrumb: breadcrumb([
      { name: 'Accueil', path: '' },
      { name: 'Audit expert SEO & GEO', path: '/audit-expert' },
    ]),
  },
];

/* ── /methodologie ────────────────────────────────────────────────────── */

export const methodologieJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: "Méthodologie d'audit SEO & GEO — Crawlers.fr",
    description:
      "Plus de 150 points d'audit SEO, GEO et IA : 7 algorithmes propriétaires, architecture multi-fallback, scores calculés et non estimés.",
    url: `${SITE_URL}/methodologie`,
    inLanguage: 'fr-FR',
    isPartOf: SITE,
    breadcrumb: breadcrumb([
      { name: 'Accueil', path: '' },
      { name: 'Méthodologie', path: '/methodologie' },
    ]),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment Crawlers.fr réalise un audit SEO & GEO complet',
    description:
      "Méthodologie pas-à-pas : de la collecte technique au plan d'action priorisé, via 7 algorithmes propriétaires et l'enrichissement multi-LLM.",
    totalTime: 'PT3M',
    inLanguage: 'fr-FR',
    supply: [{ '@type': 'HowToSupply', name: 'URL du site à auditer' }],
    tool: [{ '@type': 'HowToTool', name: 'Plateforme Crawlers.fr' }],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Collecte technique',
        text: "Crawl du site (sitemap-first), récupération du HTML servi, headers HTTP, robots.txt, Core Web Vitals via CrUX et analyse des logs.",
        url: `${SITE_URL}/methodologie#collecte`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Analyse algorithmique',
        text: 'Exécution parallèle de 7 algorithmes propriétaires : TF-IDF, GEO Score, IAS, part de voix, triangle prédictif, empreinte lexicale, PageRank interne.',
        url: `${SITE_URL}/methodologie#algos`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Enrichissement LLM',
        text: 'Interrogation parallèle de ChatGPT, Gemini, Perplexity et Claude pour mesurer la visibilité IA, détecter les hallucinations et évaluer la citabilité.',
        url: `${SITE_URL}/methodologie#llm`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Génération de correctifs',
        text: 'Code correctif personnalisé (JSON-LD, balises méta, maillage) prêt à déployer via WordPress, GTM ou SDK sécurisé.',
        url: `${SITE_URL}/methodologie#correctifs`,
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: "Scoring et plan d'action",
        text: "Score global, export PDF, plan d'action priorisé par impact business et suivi temporel dans la console de monitoring.",
        url: `${SITE_URL}/methodologie#scoring`,
      },
    ],
  },
];

/* ── /pagespeed ───────────────────────────────────────────────────────── */

export const pagespeedJsonLd = [
  {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: 'Test PageSpeed & Core Web Vitals',
        description:
          "Testez la vitesse de votre site : LCP, INP, CLS, TTFB, recommandations d'optimisation et suivi du score Google.",
        author: { '@type': 'Person', name: 'Adrien de Volontat', url: `${SITE_URL}/auteur/adrien-de-volontat` },
        publisher: ORG,
        datePublished: '2026-04-08',
        dateModified: '2026-04-08',
        url: `${SITE_URL}/pagespeed`,
        mainEntityOfPage: `${SITE_URL}/pagespeed`,
        inLanguage: 'fr-FR',
      },
      breadcrumb([
        { name: 'Accueil', path: '' },
        { name: 'PageSpeed', path: '/pagespeed' },
      ]),
    ],
  },
  faqPage([
    {
      q: "Qu'est-ce que les Core Web Vitals ?",
      a: "Les Core Web Vitals sont trois métriques Google qui mesurent l'expérience utilisateur : LCP (vitesse d'affichage du plus grand élément), INP (réactivité aux interactions) et CLS (stabilité visuelle).",
    },
    {
      q: 'Comment améliorer son score PageSpeed ?',
      a: "Optimisez les images (WebP/AVIF, lazy loading), réduisez le JavaScript bloquant, activez la compression Brotli, utilisez un CDN, isolez le CSS critique et préchargez l'image du hero.",
    },
    {
      q: 'Le PageSpeed affecte-t-il le SEO ?',
      a: "Oui. Les Core Web Vitals sont un signal de classement Google depuis 2021 et pèsent surtout sur mobile, où la latence dégrade aussi le taux de conversion.",
    },
  ]),
];

/* ── /extension ───────────────────────────────────────────────────────── */

export const extensionJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Extension Crawlers pour Chrome',
    description:
      "Extension navigateur qui audite la page ouverte en un clic et injecte les constats SEO et GEO dans le Workbench Crawlers.fr.",
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome, Edge, Brave, Arc, Opera',
    url: `${SITE_URL}/extension`,
    publisher: ORG,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    inLanguage: 'fr-FR',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: "Installer l'extension Crawlers dans Chrome",
    totalTime: 'PT2M',
    inLanguage: 'fr-FR',
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Décompresser', text: "Décompressez le fichier crawlers-extension.zip téléchargé depuis la page /extension." },
      { '@type': 'HowToStep', position: 2, name: 'Ouvrir les extensions', text: 'Ouvrez chrome://extensions dans Chrome, Edge, Brave, Arc ou Opera.' },
      { '@type': 'HowToStep', position: 3, name: 'Mode développeur', text: 'Activez le mode développeur en haut à droite de la page des extensions.' },
      { '@type': 'HowToStep', position: 4, name: 'Charger le dossier', text: "Cliquez sur « Charger l'extension non empaquetée » puis sélectionnez le dossier décompressé." },
      { '@type': 'HowToStep', position: 5, name: 'Se connecter', text: "Épinglez l'extension, ouvrez le panneau latéral, connectez-vous avec votre compte Crawlers puis lancez un audit." },
    ],
  },
];

/* ── /features/cocoon ─────────────────────────────────────────────────── */

export const cocoonJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Cocon sémantique 3D : maillage interne et cannibalisation',
    description:
      'Visualisation 3D du cocon sémantique : maillage interne, détection de cannibalisation, auto-maillage, clustering et ROI prédictif GEO.',
    url: `${SITE_URL}/features/cocoon`,
    inLanguage: 'fr-FR',
    isPartOf: SITE,
    breadcrumb: breadcrumb([
      { name: 'Accueil', path: '' },
      { name: 'Cocon sémantique 3D', path: '/features/cocoon' },
    ]),
  },
  faqPage([
    {
      q: "Qu'est-ce qu'un cocon sémantique ?",
      a: "Un cocon sémantique est une organisation du maillage interne où chaque page traite une intention unique et renvoie vers les pages qui la complètent. L'objectif est de concentrer le signal thématique sur une page pilier plutôt que de le disperser.",
    },
    {
      q: 'Comment détecter la cannibalisation entre deux pages ?',
      a: "La cannibalisation apparaît quand deux URL ciblent la même intention et se substituent l'une à l'autre dans les résultats. Elle se mesure en croisant la similarité sémantique des contenus et les requêtes communes en impressions dans Search Console.",
    },
    {
      q: 'Le cocon sémantique sert-il aussi pour les moteurs génératifs ?',
      a: "Oui. Un LLM extrait plus facilement une réponse d'un ensemble de pages hiérarchisé et non redondant : la page pilier fournit la définition citable, les satellites les cas d'usage.",
    },
  ]),
];

/* ── /blog ────────────────────────────────────────────────────────────── */

export const blogIndexJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog Crawlers.fr',
    description:
      "Actualités SEO, GEO et visibilité IA : guides pratiques, études de cas et veille algorithmique Google et LLM.",
    url: `${SITE_URL}/blog`,
    inLanguage: 'fr-FR',
    publisher: ORG,
    isPartOf: SITE,
    breadcrumb: breadcrumb([
      { name: 'Accueil', path: '' },
      { name: 'Blog', path: '/blog' },
    ]),
  },
];
