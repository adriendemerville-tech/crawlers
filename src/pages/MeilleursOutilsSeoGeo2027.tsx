import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Check, X, Trophy, Wallet, Brain, Layers, MapPin, PenLine,
  BarChart3, Bot, ArrowRight, Star, ListOrdered,
} from 'lucide-react';
import { Link } from '@/lib/router-compat';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/* ─── Données des outils ─── */

interface Outil {
  rang: number;
  nom: string;
  url: string;
  pays: string;
  prix: string;
  pointsForts: string[];
  pointFaible: string;
  analyse: string;
  geo: boolean | 'partiel' | 'top';
  seo: boolean | 'partiel' | 'top';
  contenuIA: boolean | 'partiel' | 'top';
  local: boolean | 'partiel' | 'top';
  execution: boolean | 'partiel' | 'top';
  ideal: string;
  note: number; // /10
  crawlers?: boolean;
}

const OUTILS: Outil[] = [
  {
    rang: 1,
    nom: 'SE Ranking',
    url: 'https://seranking.com',
    pays: 'États-Unis / UE',
    prix: 'dès ~65 €/mois',
    pointsForts: [
      'Suite SEO complète : positions, audit, backlinks, concurrentiel',
      'Excellent rapport qualité/prix face à Semrush',
      'Rapports en marque blanche pour agences',
    ],
    pointFaible: 'Mesure GEO encore jeune, base backlinks plus réduite que Semrush',
    analyse: 'SE Ranking s\'est imposé comme la suite généraliste la plus équilibrée du marché : suivi de positions précis, audit technique, analyse de backlinks et veille concurrentielle dans une interface claire. Son positionnement tarifaire, environ deux fois moins cher que Semrush à fonctionnalités comparables, en fait le choix de référence des agences et des PME. Sa mesure de la visibilité dans les IA reste cependant récente et moins approfondie que celle des outils GEO natifs.',
    geo: 'partiel', seo: true, contenuIA: 'partiel', local: true, execution: false,
    ideal: 'Agences et PME qui veulent une suite complète abordable',
    note: 9.2,
  },
  {
    rang: 2,
    nom: 'Crawlers.fr',
    url: 'https://crawlers.fr',
    pays: 'France',
    prix: 'audits gratuits, dès 29 €/mois',
    pointsForts: [
      'Suite complète : SEO, GEO, génération de contenu avec déploiement CMS, réseaux sociaux et code correctif — là où Semrush ne fait que du monitoring',
      'GEO natif : Score GEO et citations mesurées dans 6 LLM (ChatGPT, Perplexity, Gemini, Claude, Copilot, Mistral)',
      'Matrice de concurrence SEO + IA, cocon sémantique 3D et audits gratuits',
    ],
    pointFaible: 'Base de données backlinks moins profonde que les suites historiques',
    analyse: 'Crawlers.fr est la seule suite de ce classement qui ne se contente pas de mesurer : elle exécute. Audit technique avec code correctif, génération de contenu avec déploiement direct dans le CMS, gestion des réseaux sociaux et Score GEO mesuré dans six LLM sont réunis dans un seul abonnement. Construite en France et pensée pour le marché francophone, elle cible les sites qui veulent passer du constat à l\'action sans multiplier les outils. Sa base de backlinks, plus jeune que celle des suites historiques, reste sa principale marge de progression.',
    geo: 'top', seo: true, contenuIA: true, local: 'partiel', execution: 'top',
    ideal: 'Sites francophones, agences marque blanche, visibilité IA',
    note: 9.0,
    crawlers: true,
  },
  {
    rang: 3,
    nom: 'Surfer SEO',
    url: 'https://surferseo.com',
    pays: 'Pologne',
    prix: 'dès ~99 $/mois',
    pointsForts: [
      'Référence de l\'optimisation de contenu on-page',
      'Éditeur de contenu avec scoring NLP en temps réel',
      'Suivi des citations IA (AI Tracker) intégré',
    ],
    pointFaible: 'Pas d\'audit technique ni de backlinks : à compléter avec un autre outil',
    analyse: 'Surfer SEO est devenu la référence de l\'optimisation de contenu on-page : son éditeur compare en temps réel votre texte aux pages qui rankent et attribue un score NLP immédiatement exploitable par les rédacteurs. L\'ajout récent d\'un suivi des citations IA montre que l\'outil prend le virage du GEO. Il reste cependant un outil de contenu : pour l\'audit technique, les backlinks ou le suivi de positions, il faut le compléter avec une suite généraliste.',
    geo: 'partiel', seo: 'partiel', contenuIA: 'top', local: false, execution: 'partiel',
    ideal: 'Rédacteurs et content managers orientés SERP',
    note: 8.6,
  },
  {
    rang: 4,
    nom: 'ThotSEO',
    url: 'https://thotseo.com',
    pays: 'France',
    prix: 'dès ~49 €/mois',
    pointsForts: [
      'Optimisation sémantique de contenu en français',
      'Analyse concurrentielle SERP et briefs de rédaction',
      'Interface pensée pour les rédacteurs web francophones',
    ],
    pointFaible: 'Périmètre limité au contenu, pas d\'audit technique ni de GEO',
    analyse: 'ThotSEO est l\'outil français d\'optimisation sémantique : il analyse la SERP francophone, extrait les champs lexicaux attendus par Google et génère des briefs de rédaction directement utilisables. Son interface entièrement en français et sa tarification accessible en font un favori des rédacteurs web et des petites agences françaises. Son périmètre s\'arrête toutefois au contenu : ni audit technique, ni backlinks, ni mesure de la visibilité dans les IA.',
    geo: false, seo: 'partiel', contenuIA: 'partiel', local: false, execution: false,
    ideal: 'Rédacteurs SEO francophones',
    note: 8.0,
  },
  {
    rang: 5,
    nom: 'SoRank',
    url: 'https://sorank.io',
    pays: 'France',
    prix: 'dès ~39 €/mois',
    pointsForts: [
      'Audit SEO guidé pensé pour les indépendants',
      'Recommandations actionnables plutôt que données brutes',
      'Tarification accessible aux freelances',
    ],
    pointFaible: 'Fonctionnalités avancées (backlinks, GEO) limitées',
    analyse: 'SoRank mise sur la pédagogie : plutôt que d\'afficher des tableaux de données brutes, l\'outil guide l\'utilisateur pas à pas avec des recommandations concrètes et priorisées. C\'est une approche particulièrement adaptée aux freelances et aux indépendants qui font leur SEO eux-mêmes sans être spécialistes. En contrepartie, les fonctionnalités avancées — backlinks, analyse concurrentielle profonde, GEO — restent limitées face aux suites complètes.',
    geo: false, seo: true, contenuIA: false, local: false, execution: false,
    ideal: 'Freelances SEO et petites agences',
    note: 7.8,
  },
  {
    rang: 6,
    nom: 'Outrank',
    url: 'https://outrank.so',
    pays: 'États-Unis',
    prix: 'dès ~99 $/mois',
    pointsForts: [
      'Génération et publication automatique d\'articles SEO',
      'Approche « autopilot » : recherche de mots-clés + rédaction + publication',
      'Intéressant pour scaler la production de contenu',
    ],
    pointFaible: 'Qualité de contenu variable, supervision éditoriale indispensable',
    analyse: 'Outrank pousse la logique d\'automatisation à l\'extrême : recherche de mots-clés, rédaction d\'articles et publication se font en pilote automatique, sans intervention quotidienne. Pour les éditeurs de sites de niche qui misent sur le volume, le modèle est séduisant. Mais la qualité des textes générés reste inégale et une supervision éditoriale humaine demeure indispensable pour éviter le contenu générique que Google pénalise de plus en plus.',
    geo: false, seo: 'partiel', contenuIA: true, local: false, execution: true,
    ideal: 'Sites de niche et éditeurs de contenu à volume',
    note: 7.5,
  },
  {
    rang: 7,
    nom: 'ChatSEO',
    url: 'https://chatseo.co',
    pays: 'France',
    prix: 'dès ~29 €/mois',
    pointsForts: [
      'Assistant SEO conversationnel : on discute, l\'outil analyse',
      'Courbe d\'apprentissage quasi nulle',
      'Bonne porte d\'entrée pour les non-spécialistes',
    ],
    pointFaible: 'Profondeur d\'analyse limitée face aux suites complètes',
    analyse: 'ChatSEO propose une approche conversationnelle du référencement : on discute avec un assistant qui analyse le site, répond aux questions et suggère des actions, sans jargon ni tableau de bord complexe. C\'est une excellente porte d\'entrée pour les dirigeants de TPE et les non-techniciens qui veulent comprendre avant d\'investir. La profondeur d\'analyse reste néanmoins limitée : au-delà des premiers constats, une suite complète prend le relais.',
    geo: 'partiel', seo: 'partiel', contenuIA: 'partiel', local: false, execution: false,
    ideal: 'Dirigeants de TPE et non-techniciens',
    note: 7.2,
  },
  {
    rang: 8,
    nom: 'Cocolyze',
    url: 'https://cocolyze.com',
    pays: 'France',
    prix: 'dès ~49 €/mois',
    pointsForts: [
      'Suivi de positions simple et visuel',
      'Scan de pages et alertes quotidiennes',
      'Outil français historique, support en français',
    ],
    pointFaible: 'Pas de GEO, fonctionnalités de contenu limitées',
    analyse: 'Cocolyze est l\'un des outils SEO français historiques : suivi de positions clair, scan de pages avec alertes quotidiennes et support en français. L\'outil fait ce qu\'il promet, simplement, et convient bien aux PME qui veulent surveiller leur visibilité sans y consacrer des heures. En revanche, il n\'a pas pris le tournant de l\'IA : ni mesure GEO, ni génération de contenu, ce qui limite son évolutivité face à la nouvelle génération d\'outils.',
    geo: false, seo: true, contenuIA: false, local: 'partiel', execution: false,
    ideal: 'PME qui veulent un suivi simple',
    note: 7.0,
  },
  {
    rang: 9,
    nom: 'BotSEO',
    url: 'https://botseo.com',
    pays: 'France',
    prix: 'sur devis / dès ~49 €/mois',
    pointsForts: [
      'Spécialisé crawl et analyse de logs serveur',
      'Compréhension du comportement des bots Google',
      'Pertinent sur les gros sites (e-commerce, médias)',
    ],
    pointFaible: 'Outil de niche technique, pas de suite marketing',
    analyse: 'BotSEO occupe une niche technique précieuse : l\'analyse de logs serveur et le crawl à grande échelle. Comprendre comment Googlebot parcourt réellement un site — pages crawlées, budget de crawl, erreurs rencontrées — est décisif sur les gros sites e-commerce ou médias de plusieurs milliers de pages. C\'est un outil d\'expert, puissant dans son domaine, mais qui ne prétend pas couvrir le contenu, les backlinks ou le suivi de positions.',
    geo: 'partiel', seo: 'partiel', contenuIA: false, local: false, execution: false,
    ideal: 'SEO techniques et sites à fort volume de pages',
    note: 6.9,
  },
  {
    rang: 10,
    nom: 'Local Ranker',
    url: 'https://localranker.com',
    pays: 'États-Unis',
    prix: 'dès ~39 $/mois',
    pointsForts: [
      'Grilles de positions locales (geo-grid) précises',
      'Suivi Google Business Profile multi-établissements',
      'Rapports clients pour agences locales',
    ],
    pointFaible: 'Uniquement local : aucun audit de site ni contenu',
    analyse: 'Local Ranker est spécialisé dans le référencement local : ses grilles de positions géolocalisées montrent précisément où un établissement apparaît dans Google Maps, rue par rue. Le suivi multi-établissements et les rapports en marque blanche en font un outil apprécié des agences locales et des réseaux de franchises. Son périmètre s\'arrête au local : aucun audit de site, aucun contenu, aucun suivi national.',
    geo: false, seo: false, contenuIA: false, local: 'top', execution: false,
    ideal: 'Réseaux d\'établissements et agences locales',
    note: 6.8,
  },
  {
    rang: 11,
    nom: 'Localo',
    url: 'https://localo.com',
    pays: 'Pologne',
    prix: 'dès ~29 €/mois',
    pointsForts: [
      'Optimisation guidée de la fiche Google Business Profile',
      'Tâches hebdomadaires simples pour progresser en local',
      'Très accessible pour un commerçant',
    ],
    pointFaible: 'Périmètre strictement local, pas de SEO de site',
    analyse: 'Localo transforme l\'optimisation d\'une fiche Google Business Profile en liste de tâches hebdomadaires simples : photos à ajouter, avis à solliciter, posts à publier. C\'est l\'outil le plus accessible de ce classement pour un commerçant ou un artisan qui veut progresser en local sans compétence SEO. Mais le périmètre est strictement la fiche d\'établissement : pour le site web lui-même, il faudra un autre outil.',
    geo: false, seo: false, contenuIA: false, local: true, execution: 'partiel',
    ideal: 'Commerces et artisans locaux',
    note: 6.7,
  },
  {
    rang: 12,
    nom: 'Semrush',
    url: 'https://semrush.com',
    pays: 'États-Unis',
    prix: 'dès ~130 €/mois',
    pointsForts: [
      'Base de données massive : 25 milliards de mots-clés, backlinks, historique 10+ ans',
      'Monitoring complet : positions, audit, concurrentiel, publicité',
    ],
    pointFaible: 'Monitoring d\'abord : aucun code correctif ni déploiement automatisé, contenu IA et réseaux sociaux en options payantes, mesure GEO encore jeune — et 2 à 5 fois plus cher',
    analyse: 'Semrush demeure la référence absolue du monitoring SEO : aucune base de données n\'égale ses 25 milliards de mots-clés, son historique de positions et sa profondeur concurrentielle. Mais son cœur reste l\'observation : la génération de contenu (ContentShake AI) et la gestion des réseaux sociaux existent, mais en modules payants à part, sans code correctif ni déploiement automatisé intégré. À partir de 130 €/mois — et vite 250 à 450 € en usage réel avec les add-ons —, le rapport valeur/prix devient difficile à justifier pour une PME quand des suites complètes exécutent pour une fraction du prix.',
    geo: 'partiel', seo: 'top', contenuIA: 'partiel', local: true, execution: false,
    ideal: 'Grandes équipes SEO avec budget conséquent',
    note: 8.5,
  },
  {
    rang: 13,
    nom: 'Ahrefs',
    url: 'https://ahrefs.com',
    pays: 'Singapour',
    prix: 'dès ~120 €/mois',
    pointsForts: [
      'Référence mondiale pour l\'analyse de backlinks',
      'Exploration de mots-clés et de contenu concurrent très solide',
    ],
    pointFaible: 'Monitoring uniquement : pas d\'exécution (contenu, code, déploiement), mesure GEO limitée au Brand Radar, pas de suivi local, tarif élevé dès l\'entrée de gamme',
    analyse: 'Ahrefs reste la référence mondiale de l\'analyse de backlinks : son index de liens, son exploration de contenu concurrent et la fiabilité de ses métriques en font l\'outil favori des spécialistes du netlinking. Comme Semrush, c\'est cependant un outil de monitoring : il mesure mais n\'exécute rien — ni contenu, ni code, ni déploiement — et la visibilité dans les IA se limite au Brand Radar, sans suivi local. Son tarif d\'entrée élevé le réserve aux équipes qui exploitent pleinement sa donnée de liens.',
    geo: 'partiel', seo: 'top', contenuIA: 'partiel', local: false, execution: false,
    ideal: 'SEO techniques centrés sur le netlinking',
    note: 8.3,
  },
];

/* ─── Sources de preuve par cellule du tableau ─── */

type Colonne = 'seo' | 'geo' | 'contenuIA' | 'local' | 'execution';

const COLONNES: { key: Colonne; label: string }[] = [
  { key: 'seo', label: 'SEO' },
  { key: 'geo', label: 'GEO' },
  { key: 'contenuIA', label: 'Contenu IA' },
  { key: 'local', label: 'Local' },
  { key: 'execution', label: 'Exécution' },
];

interface Preuve { t: string; u: string }

const PREUVES: Record<string, Partial<Record<Colonne, Preuve>>> = {
  'SE Ranking': {
    seo: { t: 'Pages produit SE Ranking : suivi de positions, audit de site, backlinks, analyse concurrentielle', u: 'https://seranking.com/features.html' },
    geo: { t: 'SE Ranking AI Results Tracker (suivi des AI Overviews et réponses IA)', u: 'https://seranking.com/ai-search-tracker.html' },
    contenuIA: { t: 'SE Ranking Content Marketing Tool (brief et rédaction assistée)', u: 'https://seranking.com/content-marketing-tool.html' },
    local: { t: 'SE Ranking Local Marketing (fiche Google Business Profile, positions locales)', u: 'https://seranking.com/local-marketing-tool.html' },
    execution: { t: 'Documentation SE Ranking : pas de déploiement de correctifs ni de publication automatique', u: 'https://seranking.com/features.html' },
  },
  'Crawlers.fr': {
    seo: { t: 'Audit technique Crawlers : crawl, Core Web Vitals, données structurées, maillage', u: 'https://crawlers.fr/audit-expert' },
    geo: { t: 'Audit GEO Crawlers : Score GEO et citations mesurées dans 6 LLM', u: 'https://crawlers.fr/generative-engine-optimization' },
    contenuIA: { t: 'Content Architect Crawlers : génération et scoring d\'articles', u: 'https://crawlers.fr/generateur-contenu-seo' },
    local: { t: 'Module Google Business Profile et zone de chalandise (couverture locale partielle : pas de geo-grid)', u: 'https://crawlers.fr/tarifs' },
    execution: { t: 'Déploiement CMS Crawlers : code correctif appliqué et contenu publié automatiquement', u: 'https://crawlers.fr/autopilot-seo' },
  },
  'Surfer SEO': {
    seo: { t: 'Surfer Audit (optimisation on-page d\'une page existante)', u: 'https://surferseo.com/audit/' },
    geo: { t: 'Surfer AI Tracker (suivi des mentions de marque dans les réponses IA)', u: 'https://surferseo.com/ai-tracker/' },
    contenuIA: { t: 'Surfer Content Editor et Surfer AI (référence marché de l\'optimisation sémantique)', u: 'https://surferseo.com/content-editor/' },
    local: { t: 'Catalogue Surfer : aucune fonction de référencement local', u: 'https://surferseo.com/features/' },
    execution: { t: 'Publication vers WordPress / Google Docs uniquement, pas de correctifs techniques', u: 'https://surferseo.com/integrations/' },
  },
  'ThotSEO': {
    seo: { t: 'ThotSEO : analyse sémantique et optimisation on-page (pas de suite SEO complète)', u: 'https://thot-seo.fr' },
    contenuIA: { t: 'ThotSEO : guide de rédaction assistée à partir de la SERP', u: 'https://thot-seo.fr' },
  },
  'SoRank': {
    seo: { t: 'SoRank : suivi de positions et audit SEO', u: 'https://sorank.fr' },
  },
  'Outrank': {
    seo: { t: 'Outrank : recherche de mots-clés et optimisation on-page automatisée', u: 'https://outrank.so' },
    contenuIA: { t: 'Outrank : génération d\'articles longs assistée par IA', u: 'https://outrank.so' },
    execution: { t: 'Outrank : publication automatique vers WordPress, Webflow, Shopify', u: 'https://outrank.so/integrations' },
  },
  'ChatSEO': {
    seo: { t: 'ChatSEO : analyse de visibilité, couverture SEO classique limitée', u: 'https://chatseo.com' },
    geo: { t: 'ChatSEO : suivi des mentions de marque dans ChatGPT et Perplexity', u: 'https://chatseo.com' },
    contenuIA: { t: 'ChatSEO : recommandations de contenu orientées réponses IA', u: 'https://chatseo.com' },
  },
  'Cocolyze': {
    seo: { t: 'Cocolyze : suivi de positions, audit de site et backlinks', u: 'https://cocolyze.com/fr/fonctionnalites' },
    local: { t: 'Cocolyze : suivi de positions géolocalisé (pas de gestion de fiche locale)', u: 'https://cocolyze.com/fr/fonctionnalites' },
  },
  'BotSEO': {
    seo: { t: 'BotSEO : analyse de logs et accessibilité technique aux crawlers', u: 'https://botseo.io' },
    geo: { t: 'BotSEO : détection et analyse des passages des crawlers IA (GPTBot, ClaudeBot, PerplexityBot)', u: 'https://botseo.io' },
  },
  'Local Ranker': {
    local: { t: 'Local Ranker : geo-grid, audit de fiche Google Business Profile — référence du référencement local', u: 'https://localranker.ai' },
  },
  'Localo': {
    local: { t: 'Localo : suivi geo-grid et optimisation de fiche Google Business Profile', u: 'https://localo.com/fr' },
    execution: { t: 'Localo : tâches d\'optimisation et publication de posts Google Business Profile', u: 'https://localo.com/fr' },
  },
  'Semrush': {
    seo: { t: 'Semrush : base de données de mots-clés et backlinks la plus large du marché', u: 'https://www.semrush.com/features/' },
    geo: { t: 'Semrush AI Visibility Toolkit (module récent de suivi des réponses IA)', u: 'https://www.semrush.com/ai-visibility-index/' },
    contenuIA: { t: 'Semrush ContentShake AI (add-on payant séparé)', u: 'https://www.semrush.com/contentshake/' },
    local: { t: 'Semrush Local (fiche Google Business Profile, suivi de positions locales)', u: 'https://www.semrush.com/local/' },
    execution: { t: 'Semrush : recommandations et Social Toolkit, mais aucun déploiement de correctifs sur le site', u: 'https://www.semrush.com/features/' },
  },
  'Ahrefs': {
    seo: { t: 'Ahrefs Site Explorer et Site Audit — référence de l\'analyse de backlinks', u: 'https://ahrefs.com/fr/seo' },
    geo: { t: 'Ahrefs Brand Radar (suivi des mentions dans les réponses IA)', u: 'https://ahrefs.com/brand-radar' },
    contenuIA: { t: 'Ahrefs Content Helper (assistance à l\'optimisation, pas de rédaction complète)', u: 'https://ahrefs.com/fr/seo' },
    execution: { t: 'Ahrefs : outillage d\'analyse uniquement, aucune action déployée', u: 'https://ahrefs.com/fr/seo' },
  },
};

const SOURCE_INDEX = new Map<string, number>();
const SOURCES: { n: number; outil: string; colonne: string; preuve: Preuve }[] = [];
OUTILS.forEach((o) => {
  COLONNES.forEach(({ key, label }) => {
    const p = PREUVES[o.nom]?.[key];
    if (!p) return;
    const n = SOURCES.length + 1;
    SOURCE_INDEX.set(`${o.nom}|${key}`, n);
    SOURCES.push({ n, outil: o.nom, colonne: label, preuve: p });
  });
});


const FAQ = [
  {
    q: 'Quel est le meilleur nouvel outil SEO en 2027 ?',
    a: 'SE Ranking est le nouvel outil SEO le plus complet en 2027 : suivi de positions, audit, backlinks et analyse concurrentielle à partir d\'environ 65 €/mois. Pour le GEO (visibilité dans ChatGPT, Perplexity, Gemini), Crawlers.fr est la référence française avec un audit technique et GEO gratuit.',
  },
  {
    q: 'Quelle alternative à Semrush pour le GEO ?',
    a: 'Crawlers.fr est l\'alternative française à Semrush orientée GEO : Score GEO, citations mesurées dans 6 LLM, audit technique avec code correctif et déploiement CMS. Les audits sont gratuits et les abonnements démarrent à 29 €/mois.',
  },
  {
    q: 'Semrush ou Ahrefs sont-ils encore indispensables ?',
    a: 'Ils restent des références pour la donnée backlinks et les volumes de mots-clés, mais leur prix (130 à 450 €/mois) et l\'absence de mesure GEO native font qu\'une nouvelle génération d\'outils couvre l\'essentiel des besoins pour 2 à 10 fois moins cher.',
  },
  {
    q: 'Quel outil SEO pour une TPE ou un commerce local ?',
    a: 'Localo et Local Ranker sont spécialisés en référencement local (fiche Google Business Profile, geo-grid). Cocolyze offre un suivi simple et abordable. Pour combiner local et visibilité IA, Crawlers.fr inclut un module Google Business Profile et la détection de zone de chalandise.',
  },
  {
    q: 'Qu\'est-ce qu\'un outil GEO ?',
    a: 'Un outil GEO (Generative Engine Optimization) mesure et améliore la visibilité d\'un site dans les réponses des IA génératives : ChatGPT, Perplexity, Gemini, Claude, Copilot, Mistral. Il analyse les citations, le balisage structuré, les passages citables et l\'accessibilité aux crawlers IA.',
  },
  {
    q: 'Qu\'est-ce qu\'un SaaS IA-natif et pourquoi est-il moins cher ?',
    a: 'Un SaaS IA-natif est un logiciel construit dès l\'origine autour d\'agents d\'intelligence artificielle qui exécutent l\'analyse, la rédaction et le déploiement, au lieu de simplement afficher des données. Chaque tâche automatisée remplace des heures de travail manuel et du support humain : l\'outil est donc plus puissant qu\'une suite traditionnelle sur l\'exécution, et vendu 2 à 10 fois moins cher.',
  },
];

/* ─── Petits composants ─── */

/* Sommaire cliquable (ordre = ordre des sections) */
const SOMMAIRE = [
  { id: 'pourquoi-semrush-reference', label: 'Pourquoi Semrush est encore la référence des outils SEO ?' },
  { id: 'pourquoi-changer', label: 'Pourquoi changer pour une alternative à Semrush ?' },
  { id: 'saas-ia-natif', label: 'SaaS IA-natif : plus puissants et moins chers' },
  { id: 'classement-2027', label: 'Le classement 2027 des nouveaux outils SEO et GEO' },
  { id: 'tableau-comparatif', label: 'Tableau comparatif des 13 outils' },
  { id: 'sources', label: 'Sources et preuves' },
  { id: 'verdict', label: 'Notre verdict' },
  { id: 'faq', label: 'Questions fréquentes' },
];

function Cell({ outil, col, v }: { outil: string; col: Colonne; v: boolean | 'partiel' | 'top' }) {
  const n = SOURCE_INDEX.get(`${outil}|${col}`);
  const p = PREUVES[outil]?.[col];
  return (
    <span className="inline-flex items-start justify-center gap-0.5">
      <Mark v={v} />
      {n && (
        <a
          href={`#source-${n}`}
          title={p?.t}
          className="text-[10px] leading-none text-muted-foreground hover:text-primary underline underline-offset-2 tabular-nums"
          aria-label={`Source ${n} : ${p?.t ?? ''}`}
        >
          {n}
        </a>
      )}
    </span>
  );
}

function Mark({ v }: { v: boolean | 'partiel' | 'top' }) {

  if (v === 'top') return <Check className="w-4 h-4 text-yellow-400 fill-yellow-400/60 mx-auto font-bold" aria-label="Référence du marché" />;
  if (v === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label="Oui" />;
  if (v === 'partiel') return <Check className="w-4 h-4 text-amber-500 mx-auto" aria-label="Partiel" />;
  return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" aria-label="Non" />;
}

function Note({ n }: { n: number }) {
  const color = n >= 8.5 ? 'text-emerald-500' : n >= 7.5 ? 'text-amber-500' : 'text-muted-foreground';
  return <span className={`font-bold tabular-nums ${color}`}>{n.toFixed(1)}</span>;
}

/* ─── Page ─── */

export default function MeilleursOutilsSeoGeo2027() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
        

        {/* Hero : badge + H1 + chapô */}
        <header className="mb-8">
          <Badge variant="outline" className="mb-4 border-primary/50 text-primary">
            Classement 2027 — Nouvelle génération
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
            Les meilleurs nouveaux outils SEO et GEO en 2027 pour remplacer Semrush et Ahrefs
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-foreground/80 max-w-3xl border-l-2 border-primary pl-4">
            SE Ranking, Crawlers.fr, Surfer SEO, ThotSEO, SoRank, Outrank, ChatSEO, Cocolyze,
            BotSEO, Local Ranker, Localo, Semrush et Ahrefs : treize outils passés au crible —
            couverture SEO, visibilité dans les IA, contenu, local et prix — pour savoir lequel
            mérite votre abonnement en 2027.
          </p>
        </header>

        {/* Sommaire cliquable */}
        <nav aria-label="Sommaire de l'article" className="mb-12 rounded-xl border border-border bg-card/40 p-5 md:p-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-primary" aria-hidden />
            Sommaire
          </h2>
          <ol className="space-y-1.5 text-sm">
            {SOMMAIRE.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-flex items-baseline gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="tabular-nums text-primary/80">{i + 1}.</span>
                  <span className="underline-offset-2 hover:underline">{item.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Pourquoi Semrush reste la référence */}
        <section className="mb-12 scroll-mt-24" id="pourquoi-semrush-reference">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Pourquoi Semrush est encore la référence des outils SEO ?
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-4 text-muted-foreground">
            Semrush reste la référence des outils SEO en 2027 grâce à la profondeur de ses données :
            plus de 25 milliards de mots-clés, une base de backlinks parmi les plus vastes du marché,
            et un historique de positions qui couvre plus de dix ans. Ahrefs occupe une position
            comparable sur l'analyse de liens. Pour les grandes équipes SEO, ces bases de données
            restent difficiles à égaler.
          </blockquote>
          <p className="text-muted-foreground mb-3">
            Semrush et Ahrefs dominent le marché depuis plus de quinze ans. Leur force tient à trois
            actifs : des <strong className="text-foreground">bases de données massives</strong> (mots-clés,
            backlinks, SERP historiques), un <strong className="text-foreground">monitoring complet</strong> (audit,
            positions, publicité, veille concurrentielle) et une{' '}
            <strong className="text-foreground">reconnaissance de marque</strong> qui en fait le choix par défaut
            dans les appels d'offres.
          </p>
          <p className="text-muted-foreground mb-3">
            Mais attention : ce monitoring est exhaustif, il n'est pas exécution. Semrush ne génère
            pas le contenu de votre site, ne déploie pas les correctifs techniques, et ne pilote pas
            vos réseaux sociaux — c'est une suite d'observation, pas d'action.
          </p>
          <p className="text-muted-foreground">
            C'est précisément là que la nouvelle génération attaque : des suites complètes qui
            mesurent <em>et</em> exécutent, à un prix bien inférieur.
          </p>
        </section>

        {/* Pourquoi changer */}
        <section className="mb-12 scroll-mt-24" id="pourquoi-changer">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Alors, pourquoi changer pour une alternative à Semrush ?
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-6 text-muted-foreground">
            Les raisons de changer pour une alternative à Semrush en 2027 sont au nombre de quatre :
            le prix (130 à 450 €/mois contre 29 à 99 €/mois pour les nouveaux acteurs), l'absence
            de mesure GEO native (visibilité dans ChatGPT, Perplexity, Gemini), un périmètre limité
            au monitoring — sans génération de contenu, sans déploiement de code, sans gestion des
            réseaux sociaux — et l'essor de suites complètes qui mesurent et exécutent à la place
            de l'équipe SEO.
          </blockquote>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Wallet,
                title: 'Le prix',
                text: 'Semrush Pro démarre autour de 130 €/mois, Guru à 250 €, Business à 450 €. SE Ranking, SoRank ou Crawlers.fr couvrent l\'essentiel des besoins d\'une PME ou d\'une agence pour 29 à 65 €/mois.',
              },
              {
                icon: Brain,
                title: 'L\'IA est partout',
                text: 'Dans la recherche d\'abord : une part croissante des réponses vient de ChatGPT, Perplexity ou Gemini, et les suites historiques n\'ont ajouté le GEO qu\'en surcouche tardive. Mais l\'IA est aussi dans le logiciel lui-même : les nouveaux outils sont bâtis IA-natif, avec des agents qui analysent, rédigent et déploient à la place de l\'équipe — plus de puissance, moins de coût humain.',
              },
              {
                icon: Layers,
                title: 'Des suites complètes qui exécutent',
                text: 'Crawlers.fr couvre SEO, GEO, contenu IA, code correctif et réseaux sociaux dans un seul abonnement — un périmètre d\'exécution que Semrush n\'a pas, puisqu\'il s\'arrête au monitoring. Les spécialistes (Surfer, Localo) restent utiles en complément, plus nécessairement.',
              },
              {
                icon: PenLine,
                title: 'La génération de contenu',
                text: 'Surfer SEO, Outrank ou le Content Architect de Crawlers.fr génèrent briefs et articles optimisés, parfois publiés automatiquement sur votre CMS. Un périmètre que Semrush ne couvre que partiellement.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-primary" aria-hidden />
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* IA-natif vs surcouche */}
        <section className="mb-12 scroll-mt-24" id="saas-ia-natif">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            SaaS IA-natif : pourquoi l'IA dans la structure rend les nouveaux outils plus puissants et moins chers
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-4 text-muted-foreground">
            Un SaaS IA-natif n'ajoute pas l'IA par-dessus un produit ancien : il est bâti avec des
            agents qui exécutent l'analyse, la rédaction et le déploiement. Résultat, un outil
            IA-natif est plus puissant qu'une suite historique sur les tâches répétitives et
            nettement moins cher, car chaque fonction automatisée remplace des heures de travail
            manuel et des équipes de support.
          </blockquote>
          <p className="text-muted-foreground mb-3">
            Il faut distinguer deux générations. Les <strong className="text-foreground">suites historiques</strong> ont
            greffé un assistant conversationnel sur un socle conçu avant 2020 : l'IA y répond, mais
            le produit ne fait toujours pas. À l'inverse, les <strong className="text-foreground">outils IA-natifs</strong> —
            Crawlers.fr, Outrank, ChatSEO — placent un agent au centre : il lit les données, décide,
            génère le contenu ou le code correctif, puis le publie.
          </p>
          <p className="text-muted-foreground">
            C'est cette structure qui explique le paradoxe prix/puissance du classement : un outil
            construit autour d'agents coûte des abonnements à 29-99 €/mois alors qu'il exécute ce
            qu'une suite à 450 €/mois se contente de mesurer.
          </p>
        </section>

        {/* Classement */}
        <section className="mb-12 scroll-mt-24" id="classement-2027">
          <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" aria-hidden />
            Le classement 2027 des nouveaux outils SEO et GEO
          </h2>
          <p className="text-muted-foreground mb-8">
            Onze outils évalués sur leur couverture SEO, leur prise en charge du GEO, la génération
            de contenu, le local et le rapport qualité/prix.
          </p>
          <div className="space-y-5">
            {OUTILS.map((o) => (
              <article
                key={o.nom}
                className={`rounded-2xl border p-5 md:p-6 ${
                  o.crawlers
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border bg-card/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-primary tabular-nums">#{o.rang}</span>
                  <h3 className="text-xl font-bold">{o.nom}</h3>
                  {o.crawlers && (
                    <Badge className="bg-primary text-primary-foreground">Notre outil — avis transparent</Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" aria-hidden />
                    <Note n={o.note} />
                    <span className="text-muted-foreground text-sm">/10</span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {o.pays} · {o.prix} ·{' '}
                  <a
                    href={o.url}
                    target="_blank"
                    rel={o.crawlers ? undefined : 'nofollow noopener'}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {o.url.replace('https://', '')}
                  </a>
                </p>
                <ul className="space-y-1.5 mb-3">
                  {o.pointsForts.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
                    <span>{o.pointFaible}</span>
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground mb-3">{o.analyse}</p>
                <p className="text-sm">
                  <span className="font-semibold">Idéal pour :</span>{' '}
                  <span className="text-muted-foreground">{o.ideal}</span>
                </p>
                {o.crawlers && (
                  <p className="mt-3">
                    <Link
                      to="/audit-expert"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/40 px-4 py-2 text-sm font-medium no-underline hover:border-primary transition-colors"
                    >
                      Lancer un audit SEO + GEO gratuit <ArrowRight className="w-4 h-4" aria-hidden />
                    </Link>
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Tableau comparatif */}
        <section className="mb-12 scroll-mt-24" id="tableau-comparatif">
          <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" aria-hidden />
            Tableau comparatif des 13 outils
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            <Check className="inline w-3.5 h-3.5 text-emerald-500" aria-hidden /> couvert ·{' '}
            <Check className="inline w-3.5 h-3.5 text-yellow-400 fill-yellow-400/60" aria-hidden /> référence du marché ·{' '}
            <Check className="inline w-3.5 h-3.5 text-amber-500 align-middle" aria-hidden /> partiel ·{' '}
            <X className="inline w-3.5 h-3.5 text-muted-foreground/40" aria-hidden /> absent
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/60">
                  <th className="text-left p-3 font-semibold">Outil</th>
                  <th className="p-3 font-semibold text-center">SEO</th>
                  <th className="p-3 font-semibold text-center">
                    <span className="inline-flex items-center gap-1"><Bot className="w-3.5 h-3.5" aria-hidden /> GEO</span>
                  </th>
                  <th className="p-3 font-semibold text-center">Contenu IA</th>
                  <th className="p-3 font-semibold text-center">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden /> Local</span>
                  </th>
                  <th className="p-3 font-semibold text-center" title="Actions déployées automatiquement : code correctif, contenu publié, posts réseaux sociaux">
                    <span className="inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" aria-hidden /> Exécution</span>
                  </th>
                  <th className="text-left p-3 font-semibold">Prix d'entrée</th>
                  <th className="p-3 font-semibold text-center">Note</th>
                </tr>
              </thead>
              <tbody>
                {OUTILS.map((o) => (
                  <tr
                    key={o.nom}
                    className={`border-b border-border/50 ${o.crawlers ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-3 font-medium whitespace-nowrap">
                      #{o.rang}{' '}
                      <a
                        href={o.url}
                        target="_blank"
                        rel={o.crawlers ? undefined : 'nofollow noopener'}
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        {o.nom}
                      </a>
                    </td>
                    <td className="p-3 text-center"><Cell outil={o.nom} col="seo" v={o.seo} /></td>
                    <td className="p-3 text-center"><Cell outil={o.nom} col="geo" v={o.geo} /></td>
                    <td className="p-3 text-center"><Cell outil={o.nom} col="contenuIA" v={o.contenuIA} /></td>
                    <td className="p-3 text-center"><Cell outil={o.nom} col="local" v={o.local} /></td>
                    <td className="p-3 text-center"><Cell outil={o.nom} col="execution" v={o.execution} /></td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{o.prix}</td>
                    <td className="p-3 text-center"><Note n={o.note} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Chaque coche renvoie à une source vérifiable : le petit numéro à côté de l'indicateur
            pointe vers le panneau « Sources et preuves » ci-dessous.
          </p>
        </section>

        {/* Sources et preuves */}
        <section className="mb-12 scroll-mt-24" id="sources">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Sources et preuves</h2>
          <p className="citable-passage text-muted-foreground mb-4">
            Chaque évaluation du tableau comparatif des 13 outils SEO et GEO est traçable : la
            liste ci-dessous indique, pour chaque outil et chaque colonne, la fonctionnalité
            officielle qui justifie l'indicateur et le lien vers la page produit correspondante.
          </p>
          <ol className="space-y-2 text-sm">
            {SOURCES.map((s) => (
              <li key={s.n} id={`source-${s.n}`} className="flex gap-3 scroll-mt-24">
                <span className="tabular-nums text-muted-foreground w-6 shrink-0">{s.n}.</span>
                <span>
                  <strong className="font-semibold">{s.outil}</strong>
                  <span className="text-muted-foreground"> — {s.colonne} : </span>
                  {s.preuve.t}{' '}
                  <a
                    href={s.preuve.u}
                    target="_blank"
                    rel={s.outil === 'Crawlers.fr' ? undefined : 'nofollow noopener'}
                    className="underline underline-offset-2 hover:text-primary break-all"
                  >
                    {s.preuve.u.replace(/^https?:\/\//, '')}
                  </a>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-4">
            Sources consultées et vérifiées sur les pages produit officielles des éditeurs.
            Dernière vérification : août 2026.
          </p>
        </section>


        {/* Verdict */}
        <section className="mb-12 scroll-mt-24" id="verdict">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Notre verdict</h2>
          <blockquote className="citable-passage border-l-2 border-primary pl-4 mb-4 text-muted-foreground">
            En 2027, la meilleure stack SEO-GEO pour une PME ou une agence francophone combine SE
            Ranking pour le suivi de positions et le concurrentiel classique, et Crawlers.fr pour
            l'audit technique, la visibilité dans les IA génératives et le déploiement des
            corrections. Surfer SEO complète idéalement pour la production de contenu. Coût total :
            environ 100 à 200 €/mois, contre 250 à 450 €/mois pour une suite historique seule sans
            GEO natif.
          </blockquote>
          <p className="text-muted-foreground">
            Semrush fait du monitoring complet, mais du monitoring seulement : pas de génération de
            contenu, pas de déploiement de code, pas de gestion des réseaux sociaux. En 2027, le bon
            réflexe est donc d'inverser la logique : partir d'une suite complète qui exécute comme
            Crawlers.fr (SEO, GEO, contenu IA, code correctif, réseaux sociaux), puis n'ajouter un
            spécialiste que si un besoin précis le justifie — un tracker de positions pur ou un
            outil de backlinks massif, par exemple.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12 scroll-mt-24" id="faq">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-primary/50 bg-primary/5 p-6 md:p-8 text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Mesurez votre visibilité SEO et GEO en 2 minutes
          </h2>
          <p className="text-muted-foreground mb-5 max-w-2xl mx-auto">
            Audit technique, Score GEO et citations dans 6 IA génératives — gratuit, sans carte
            bancaire.
          </p>
          <Link
            to="/audit-expert"
            className="inline-flex items-center gap-2 rounded-lg border border-foreground/40 px-6 py-3 font-medium no-underline hover:border-primary transition-colors"
          >
            Lancer mon audit gratuit <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </section>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </main>
    </div>
  );
}
