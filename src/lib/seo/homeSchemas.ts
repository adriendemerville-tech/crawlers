/**
 * JSON-LD de la page d'accueil, rendu côté serveur via `pageHead({ jsonLd })`.
 *
 * Ce graphe vivait dans un `useEffect` (hook useStructuredData) : il n'était
 * donc jamais présent dans le HTML servi et restait invisible pour Googlebot
 * comme pour les crawlers IA (GPTBot, ClaudeBot, PerplexityBot…), qui
 * n'exécutent pas le JavaScript. Il est désormais émis en SSR.
 *
 * Le nœud Organization complet est émis sitewide depuis le root
 * (src/lib/seo/organization.ts) : ici on ne fait que le référencer par @id.
 */

import { SITE_URL } from '@/lib/seo/pageHead';
import { ORGANIZATION_REF } from '@/lib/seo/organization';

const ORG = ORGANIZATION_REF;

/** Catalogue public des outils, y compris ceux hors console. */
const TOOLS: Array<{ name: string; path: string; description: string }> = [
  { name: 'Marina — audit SEO & GEO gratuit', path: '/marina', description: "Audit complet sans compte : 40+ pages analysées, ~20 sous-audits, visibilité mesurée dans ChatGPT, Gemini, Perplexity, Claude et Mistral. Disponible aussi en API (clé mk_live_)." },
  { name: 'Matrice Concurrence', path: '/matrice-concurrence', description: "Matrice à double entrée concurrents × 20 mots-clés du marché : positions SERP, AI Overviews et citations dans ChatGPT, Gemini et Claude, avec gaps de couverture et indice de rentabilité." },
  { name: 'Audit Expert SEO & GEO', path: '/audit-expert', description: 'Audit technique 200+ points : indexabilité, Core Web Vitals, données structurées, citabilité par les moteurs génératifs, plan d’action et code correctif.' },
  { name: 'Score GEO', path: '/score-geo', description: 'Probabilité d’être cité par les moteurs de réponse IA, calculée sur des critères vérifiables.' },
  { name: 'Visibilité LLM', path: '/visibilite-llm', description: 'Part de voix de la marque dans ChatGPT, Claude, Gemini et Perplexity.' },
  { name: 'Analyse des bots IA', path: '/analyse-bots-ia', description: 'Vérification rDNS/ASN des passages GPTBot, ClaudeBot, PerplexityBot et bouclier Cloudflare.' },
  { name: 'Crawl multi-pages', path: '/site-crawl', description: 'Crawl sitemap-first jusqu’à 50 000 pages avec détection de contenu dupliqué et de coquille JS.' },
  { name: 'Cocon sémantique 3D', path: '/cocoon', description: 'Cartographie 3D du maillage interne, PageRank interne et détection de cannibalisation.' },
  { name: 'Architecte Génératif', path: '/architecte-generatif', description: 'Génération et déploiement du code correctif multi-pages via le CMS connecté.' },
  { name: 'Content Architect', path: '/content-architect', description: 'Pipeline éditoriale en 4 étapes ancrée sur les données métier du site.' },
  { name: 'E-E-A-T', path: '/eeat', description: 'Audit Expérience, Expertise, Autorité, Fiabilité version 3.' },
  { name: 'PageSpeed', path: '/pagespeed', description: 'Core Web Vitals mobile et desktop, terrain CrUX puis médiane de runs.' },
  { name: 'Observatoire sectoriel', path: '/observatoire', description: 'Indicateurs SEO et GEO agrégés par secteur.' },
  { name: 'API développeurs Crawlers', path: '/developers', description: 'Accès programmatique à l’ensemble des modules SEO, GEO et IA : jobs asynchrones REST, SDK TypeScript, wallet à l’usage.' },
];

const softwareApplication = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Crawlers.fr',
  alternateName: [
    'Crawlers',
    "Plateforme SaaS d'acquisition",
    'Suite GEO',
    "Plateforme d'intelligence de visibilité",
  ],
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: "Plateforme SaaS d'acquisition — suite SEO & GEO",
  keywords: "plateforme SaaS d'acquisition, suite GEO, plateforme d'intelligence de visibilité, audit SEO, generative engine optimization",
  operatingSystem: 'Web',
  inLanguage: ['fr', 'en', 'es'],
  datePublished: '2026-03-18',
  url: SITE_URL,
  creator: ORG,
  description:
    "Plateforme SaaS d'acquisition française : suite GEO et plateforme d'intelligence de visibilité couvrant l'audit SEO, le GEO et la visibilité IA. Audit technique 200+ points, matrice de concurrence SERP et citations IA, audit Marina, cocon sémantique 3D, autopilote éditorial, détection de bots IA, et API développeurs pour piloter tous les modules par programmation.",
  offers: [
    {
      '@type': 'Offer',
      name: 'Gratuit',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Audit SEO technique, Score GEO, Crawlability IA, PageSpeed, 2 rapports Marina et 1 matrice de concurrence par jour.',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pro Agency',
      price: '29',
      priceCurrency: 'EUR',
      description: 'Console multi-sites, tous les outils Pro, marque blanche agence.',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pro Agency+',
      price: '79',
      priceCurrency: 'EUR',
      description: '50 000 pages de crawl par mois, 3 comptes, support prioritaire.',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'API développeurs',
      priceCurrency: 'EUR',
      description: 'Facturation à l’usage par wallet : Crawlers API (modules SEO/GEO/IA), Marina API (audits en marque blanche), Parménion API (tâches de contenu).',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/developers`,
    },
  ],
  featureList: [
    'Audit SEO technique 200+ points (Core Web Vitals, crawl, schema, on-page)',
    'Matrice Concurrence : concurrents × 20 mots-clés, positions SERP, AI Overviews et citations ChatGPT/Gemini/Claude',
    'Marina : audit SEO et GEO complet gratuit sans compte, multipages, exportable en PDF',
    'Marina API : lancement d’audits en marque blanche depuis un système tiers (clé mk_live_)',
    'Crawlers API : 18 modules SEO, GEO et IA exposés en REST asynchrone (clé crw_live_)',
    'Parménion API : distribution de tâches de contenu à un worker externe (clé prm_live_)',
    'SDK TypeScript officiels @crawlers/sdk et @parmenion/sdk',
    'GEO Score 0-100 : probabilité d’être cité par ChatGPT, Claude, Perplexity, Google AI Overviews',
    'Visibilité LLM multi-modèles et benchmark parallèle',
    'Audit E-E-A-T v3',
    'Cocon sémantique 3D avec détection de cannibalisation',
    'Maillage interne automatisé (PageRank interne, intentions Know/Do/Buy)',
    'SERP Benchmark multi-providers',
    'SEA-SEO Bridge',
    'Conversion Rate Optimizer avec GA4',
    'Détection de baisse de trafic par apprentissage automatique',
    'Audit local Google Business Profile',
    'Analyse des bots IA avec vérification rDNS/ASN et bouclier Cloudflare',
    'Architecte Génératif : code correctif multi-pages',
    'Crawl multi-pages sitemap-first jusqu’à 50 000 pages',
    'Autopilote Parménion : maintenance prédictive et publication éditoriale',
    'Copilot conversationnel avec mémoire vectorielle',
    'Connexion CMS directe (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo, Webflow, REST custom)',
    'Extension Chrome Crawlers AI Sidebar',
    'Serveur MCP pour agents IA externes',
    'Marque blanche agence et gestion d’équipe multi-rôles',
  ],
  audience: { '@id': `${SITE_URL}/#audiences` },
  potentialAction: { '@type': 'UseAction', target: `${SITE_URL}/audit-expert` },
};

const toolsItemList = {
  '@type': 'ItemList',
  '@id': `${SITE_URL}/#tools`,
  name: 'Outils Crawlers.fr',
  description: 'Catalogue des outils SEO, GEO et IA de Crawlers.fr, dans la console comme en accès libre.',
  numberOfItems: TOOLS.length,
  itemListElement: TOOLS.map((tool, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: tool.name,
    description: tool.description,
    url: `${SITE_URL}${tool.path}`,
  })),
};

const audiencesItemList = {
  '@type': 'ItemList',
  '@id': `${SITE_URL}/#audiences`,
  name: 'Audiences cibles de Crawlers.fr',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Agences SEO', description: 'Audit multi-clients, marque blanche, gestion collaborative.' },
    { '@type': 'ListItem', position: 2, name: 'Freelances et consultants SEO', description: 'Analyse avancée, prospection Marina, génération de contenu.' },
    { '@type': 'ListItem', position: 3, name: 'PME et e-commerce', description: 'Audit local, fiches produit, connexion CMS directe.' },
    { '@type': 'ListItem', position: 4, name: 'Éditeurs SaaS', description: 'Score GEO, visibilité LLM, positionnement dans les moteurs de réponse.' },
    { '@type': 'ListItem', position: 5, name: 'Développeurs et intégrateurs', description: 'API REST asynchrones, SDK TypeScript, serveur MCP, webhooks.' },
  ],
};

export const HOME_FAQ_ITEMS = [
  {
    q: "Qu'est-ce que Crawlers.fr ?",
    a: "Crawlers.fr est une plateforme SaaS française d'audit SEO, GEO et visibilité IA. Elle mesure la performance d'un site sur Google et sa citabilité dans les moteurs génératifs (ChatGPT, Gemini, Perplexity, Claude), puis produit les correctifs et les déploie via le CMS connecté.",
  },
  {
    q: "Pourquoi un SaaS spécialisé plutôt qu'une IA généraliste comme Claude ou ChatGPT ?",
    a: "Une IA généraliste déduit le SEO depuis son modèle : elle ne crawle pas les pages, ne mesure pas les Core Web Vitals sur le terrain, n'interroge pas la SERP et ne connaît pas l'historique Search Console du site. Crawlers.fr mesure réellement : crawl des URL, données CrUX et PageSpeed, positions SERP multi-providers, citations observées dans plusieurs LLM, puis génère le code correctif et le publie. Là où l'IA généraliste plafonne les requêtes et impose de construire ses propres automatisations, la plateforme fournit les intégrations préconfigurées et un pipeline reproductible. Comparatif détaillé : https://crawlers.fr/comparatif-claude-vs-crawlers.",
  },
  {
    q: 'Peut-on brancher Marina en API ?',
    a: "Oui. Marina dispose d'une API REST asynchrone (clé mk_live_) : un POST crée un job d'audit, un GET récupère le rapport, avec restitution en marque blanche. La documentation est publiée sur https://crawlers.fr/docs/api/marina.",
  },
  {
    q: 'Les outils Crawlers sont-ils accessibles aux développeurs par API ?',
    a: "Oui. Trois API partagent un même compte développeur : Crawlers API (18 modules SEO, GEO et IA, clé crw_live_), Marina API (audits, clé mk_live_) et Parménion API (tâches de contenu de l'autopilote, clé prm_live_). Toutes fonctionnent en jobs asynchrones par polling, avec SDK TypeScript officiels et facturation à l'usage. Point d'entrée : https://crawlers.fr/developers.",
  },
  {
    q: "Qu'apporte la Matrice Concurrence ?",
    a: "La Matrice Concurrence croise les concurrents et le site cible avec les 20 mots-clés réellement adressés par le marché, dans la SERP Google comme dans les réponses IA. Elle produit une heatmap, les gaps de couverture, les citations IA manquantes et un indice de rentabilité par mot-clé. Elle est accessible gratuitement sur https://crawlers.fr/matrice-concurrence.",
  },
  {
    q: 'Crawlers.fr est-il gratuit ?',
    a: "Partiellement. Audit SEO technique, Score GEO, crawlabilité IA et PageSpeed sont gratuits, Marina offre 2 rapports complets sans carte bancaire et la Matrice Concurrence une analyse par jour. Les plans Pro Agency à partir de 29 € par mois ouvrent la console multi-sites et les modules avancés.",
  },
] as const;

const faqPage = {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/#faq`,
  mainEntity: HOME_FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

const breadcrumbList = {
  '@type': 'BreadcrumbList',
  '@id': `${SITE_URL}/#breadcrumb`,
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
      item: SITE_URL,
    },
  ],
};

export const homeJsonLd = [
  {
    '@context': 'https://schema.org',
    '@graph': [softwareApplication, toolsItemList, audiencesItemList, faqPage, breadcrumbList],
  },
];
