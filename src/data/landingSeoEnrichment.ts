/**
 * Central SEO/GEO enrichment data for landing pages linked from /features.
 * Keywords sourced from Semrush (database: fr) for real search volume.
 *
 * Each entry feeds <LandingSeoEnrichment slug="..." /> which renders:
 * - Long-form H2/H3/H4 content
 * - Persona block ("Pour qui ?")
 * - FAQ section (also emits FAQPage JSON-LD)
 * - Article JSON-LD + meta keywords via react-helmet-async
 */

export type EnrichmentH3 = {
  title: string;
  body: string;
  h4s?: { title: string; body: string }[];
};

export type EnrichmentSection = {
  h2: string;
  intro?: string;
  h3s: EnrichmentH3[];
};

export type EnrichmentFaq = { q: string; a: string };

export type LandingEnrichment = {
  /** Primary canonical keyword (used in JSON-LD headline) */
  primaryKeyword: string;
  /** Secondary keywords for <meta name="keywords"> */
  secondaryKeywords: string[];
  /** Persona statement injected into a callout */
  persona: {
    title: string;
    body: string;
    bullets: string[];
  };
  /** Long-form structured content */
  sections: EnrichmentSection[];
  /** FAQ — also feeds FAQPage JSON-LD */
  faqs: EnrichmentFaq[];
  /** Article datePublished (ISO) */
  datePublished?: string;
};

export const LANDING_ENRICHMENT: Record<string, LandingEnrichment> = {
  /* ─────────── BLOC GEO / VISIBILITÉ ─────────── */
  'score-geo': {
    primaryKeyword: 'score GEO',
    secondaryKeywords: ['generative engine optimization', 'référencement chatgpt', 'seo ia', 'seo geo', 'référencement geo', 'llm seo', 'seo chatgpt'],
    persona: {
      title: 'Pour qui ?',
      body: "Le Score GEO s'adresse aux responsables SEO, fondateurs et consultants qui constatent que leur trafic Google reste stable mais que ChatGPT, Claude ou Perplexity ne les citent jamais dans leurs réponses.",
      bullets: [
        'Consultants SEO qui veulent ajouter le GEO à leur offre',
        'Agences qui pilotent la visibilité IA de plusieurs clients',
        'Fondateurs SaaS dont les acheteurs interrogent les LLM avant de souscrire',
        'Responsables marketing B2B qui veulent figurer dans les AI Overviews',
      ],
    },
    sections: [
      {
        h2: 'Pourquoi le Score GEO devient indispensable en 2026',
        intro: "Le SEO classique mesure votre rang dans les SERP Google. Le Score GEO mesure une métrique différente : la probabilité qu'un moteur génératif (ChatGPT Search, Claude, Perplexity, Google AI Overviews, Gemini) cite votre page dans une réponse synthétisée.",
        h3s: [
          {
            title: 'Du bleu cliquable à la citation invisible',
            body: "En 2026, près de 30 % des recherches B2B commencent dans un LLM. L'utilisateur ne voit plus dix liens bleus : il lit une réponse rédigée, avec deux à cinq sources citées. Si votre page n'est pas dans ces sources, votre trafic baisse même si vos positions Google restent identiques.",
          },
          {
            title: 'Ce que le Score GEO mesure vraiment',
            body: "Notre score combine cinq piliers : structure (HTML sémantique, H1-H4, listes, réponses directes), données structurées (JSON-LD Article, FAQ, HowTo, Organization), accessibilité IA (robots.txt, llms.txt, headers), citabilité (phrases factuelles, statistiques sourcées, blockquotes) et autorité E-E-A-T.",
            h4s: [
              { title: 'Pilier 1 — Structure & lisibilité (25%)', body: "Hiérarchie de titres claire, paragraphes de 2-4 phrases, listes à puces et réponses directes : les LLM extraient plus facilement les passages courts et bien découpés." },
              { title: 'Pilier 2 — Données structurées (20%)', body: "JSON-LD Article, FAQPage, BreadcrumbList et Organization. Ces signaux sont parsés en priorité par les moteurs génératifs pour comprendre l'entité." },
              { title: 'Pilier 3 — Accessibilité IA (20%)', body: "robots.txt qui n'exclut pas GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot. Fichier llms.txt à la racine. Headers HTTP cohérents." },
              { title: 'Pilier 4 — Citabilité (20%)', body: "Phrases courtes et factuelles, statistiques sourcées avec dates, définitions encadrées de blockquotes, présence d'une passage citable identifiable." },
              { title: 'Pilier 5 — Autorité E-E-A-T (15%)', body: "Auteur identifié avec bio et profils, mentions externes, backlinks, cohérence du nom d'entité, dates de mise à jour visibles." },
            ],
          },
          {
            title: 'GEO vs SEO : complémentaires, pas concurrents',
            body: "Le SEO classique reste indispensable pour le trafic direct depuis google.fr. Le GEO ajoute la visibilité dans les réponses IA. Les deux partagent des fondamentaux (contenu de qualité, structure, autorité) mais le GEO exige des signaux supplémentaires : citabilité, données structurées avancées et accessibilité explicite aux crawlers IA.",
          },
        ],
      },
      {
        h2: "Comment améliorer son Score GEO concrètement",
        h3s: [
          {
            title: 'Étape 1 — Audit de citabilité',
            body: "Identifiez les passages de vos pages qui répondent directement à une question. Reformulez en phrases courtes (15-25 mots), factuelles, avec un sujet clair et une donnée chiffrée quand c'est possible. Ce sont ces blocs que les LLM extraient.",
          },
          {
            title: 'Étape 2 — Injecter le balisage Schema.org',
            body: "Article, FAQPage, HowTo, BreadcrumbList et Organization sont les types prioritaires. Chaque page doit porter au minimum un Article + un BreadcrumbList. Les pages avec questions/réponses gagnent un FAQPage.",
          },
          {
            title: 'Étape 3 — Ouvrir la porte aux crawlers IA',
            body: "Vérifiez votre robots.txt : aucun Disallow ne doit cibler GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot ou CCBot. Ajoutez un fichier /llms.txt qui résume votre site pour les LLM.",
          },
        ],
      },
    ],
    faqs: [
      { q: "Combien coûte un audit Score GEO ?", a: "Gratuit. L'audit Score GEO est inclus dans le plan gratuit Crawlers.fr et ne nécessite ni carte bancaire ni installation." },
      { q: "En combien de temps obtient-on son Score GEO ?", a: "Moins de 30 secondes. L'analyse parse la page, vérifie les cinq piliers et restitue un score sur 100 avec les recommandations classées par impact." },
      { q: "À partir de quel score est-on bien optimisé pour les IA ?", a: "Un score supérieur à 70 indique une bonne optimisation GEO. Entre 40 et 70, des progrès rapides sont possibles. En dessous de 40, votre contenu est probablement invisible pour ChatGPT et Perplexity." },
      { q: "Le Score GEO remplace-t-il les KPI SEO classiques ?", a: "Non. Position moyenne, CTR organique et trafic Google Search Console restent essentiels. Le Score GEO complète ces KPI en mesurant la visibilité dans les moteurs génératifs." },
    ],
    datePublished: '2026-04-08',
  },

  'visibilite-llm': {
    primaryKeyword: 'visibilité LLM',
    secondaryKeywords: ['référencement chatgpt', 'référencement ia', 'seo chatgpt', 'llm seo', 'seo llm', 'comment être référencé sur chatgpt', 'référencement geo'],
    persona: {
      title: 'Pour qui ?',
      body: "Les marques B2B et SaaS dont les prospects interrogent ChatGPT, Claude ou Perplexity avant un achat — et qui veulent figurer dans la réponse plutôt que dans les sources qu'on ne clique pas.",
      bullets: [
        'Directions marketing B2B (logiciels, services, conseil)',
        'Fondateurs SaaS dont le cycle de vente démarre par une recherche IA',
        'Consultants qui veulent prouver leur visibilité IA à leurs clients',
        'Agences SEO qui ajoutent un tracking LLM à leur reporting',
      ],
    },
    sections: [
      {
        h2: 'Mesurer sa visibilité dans ChatGPT, Claude et Perplexity',
        intro: "Le référencement ChatGPT ne se mesure pas comme le référencement Google. Il n'y a pas de SERP stable, pas de position fixe : la même question peut donner une réponse différente d'une session à l'autre. Le tracking de visibilité LLM consiste à interroger les modèles avec un panel de questions stratégiques et à mesurer dans quelle proportion votre marque est citée.",
        h3s: [
          {
            title: "Pourquoi le SEO LLM diffère du SEO classique",
            body: "Un LLM ne classe pas des liens : il synthétise une réponse à partir de ses données d'entraînement et, pour les modèles avec recherche en direct (ChatGPT Search, Perplexity, Gemini), à partir de pages crawlées en temps réel. Être visible exige donc à la fois une présence dans le corpus historique et un crawl IA actif.",
          },
          {
            title: 'Les trois leviers du référencement IA',
            body: "Pour être cité, une marque doit cumuler : une forte autorité d'entité (mentions répétées dans des sources fiables), des pages techniquement accessibles aux crawlers IA, et un contenu rédigé en mode citable (phrases factuelles courtes, données chiffrées, définitions claires).",
            h4s: [
              { title: 'Levier 1 — Autorité d\'entité', body: "Plus votre marque est mentionnée avec cohérence (même nom, même description, mêmes attributs) dans des sources tierces, plus le LLM apprend à vous associer à votre catégorie." },
              { title: 'Levier 2 — Accessibilité technique', body: "robots.txt ouvert aux bots IA, fichier llms.txt présent, JSON-LD Organization déclaré sur chaque page, sitemap à jour." },
              { title: 'Levier 3 — Citabilité du contenu', body: "Réponses directes en début de section, statistiques avec source et date, formats Q/R, blockquotes pour les passages clés." },
            ],
          },
          {
            title: 'Méthodologie de tracking Crawlers',
            body: "Nous interrogeons quatre moteurs (ChatGPT, Claude, Perplexity, Gemini) avec un panel de questions construit à partir de votre cocon sémantique et de vos requêtes prioritaires GSC. Nous mesurons le taux de citation, la position relative dans la réponse et les concurrents systématiquement préférés au vôtre.",
          },
        ],
      },
      {
        h2: "Optimiser concrètement son référencement ChatGPT",
        h3s: [
          { title: 'Diagnostiquer les requêtes où vous devriez apparaître', body: "Listez les 20 à 50 questions qu'un acheteur de votre catégorie poserait à ChatGPT. Interrogez le modèle et notez celles où votre marque est absente alors qu'un concurrent direct est cité : ce sont vos priorités." },
          { title: 'Travailler les pages-réponses', body: "Pour chaque question prioritaire, identifiez ou créez une page qui répond explicitement, avec un H1 reprenant la question et un premier paragraphe de 40-60 mots qui constitue la réponse directe." },
          { title: 'Construire l\'autorité d\'entité', body: "Publiez sur des sources tierces (médias spécialisés, podcasts, plateformes communautaires), demandez à être cité dans des comparatifs, soignez vos pages About / Mentions / Auteurs." },
        ],
      },
    ],
    faqs: [
      { q: "Comment être référencé sur ChatGPT en 2026 ?", a: "Trois conditions cumulatives : ouvrir l'accès à GPTBot et OAI-SearchBot dans votre robots.txt, structurer vos pages avec JSON-LD Article et FAQ, et accumuler des mentions cohérentes de votre marque sur des sources tierces fiables." },
      { q: "Quelle différence entre SEO IA, LLM SEO et GEO ?", a: "Les trois termes désignent la même discipline : optimiser un site pour que les moteurs génératifs (ChatGPT, Claude, Perplexity, Gemini, AI Overviews) le citent. GEO (Generative Engine Optimization) est le terme académique le plus utilisé." },
      { q: "Combien de temps avant d'être cité par un LLM ?", a: "Comptez 4 à 12 semaines après mise en place des correctifs techniques et publication des pages-réponses. Les LLM avec recherche live (Perplexity, ChatGPT Search) réagissent plus vite que les modèles entraînés." },
      { q: "Peut-on payer pour être cité par ChatGPT ?", a: "Non. Il n'existe pas d'équivalent Google Ads pour les réponses IA. La visibilité s'obtient uniquement par l'autorité d'entité et la qualité technique du contenu." },
    ],
    datePublished: '2026-04-08',
  },

  'analyse-bots-ia': {
    primaryKeyword: 'analyse bots IA',
    secondaryKeywords: ['gptbot', 'claudebot', 'perplexitybot', 'oai-searchbot', 'crawler ia', 'crawler web', 'robots.txt bots ia', 'google-extended'],
    persona: {
      title: 'Pour qui ?',
      body: "Webmasters, équipes SEO et DSI qui veulent savoir quels bots IA visitent réellement leur site, lesquels sont bloqués par erreur, et lesquels devraient l'être.",
      bullets: [
        'Équipes SEO qui veulent valider l\'accès des crawlers IA',
        'DSI qui surveillent la charge serveur générée par les bots',
        'Consultants qui auditent le robots.txt de leurs clients',
        'Fondateurs qui veulent prouver leur ouverture au crawl IA',
      ],
    },
    sections: [
      {
        h2: 'Quels bots IA crawlent votre site en 2026',
        intro: "Une vingtaine de crawlers IA actifs explorent désormais le web. Connaître leur user-agent et leur comportement est essentiel pour décider lesquels autoriser, lesquels limiter et lesquels bloquer.",
        h3s: [
          {
            title: 'Les crawlers IA officiels à connaître',
            body: "Les principaux acteurs publient leur user-agent et leurs plages d'IP. Les autoriser est la condition de base pour être cité dans leurs produits.",
            h4s: [
              { title: 'OpenAI — GPTBot, OAI-SearchBot, ChatGPT-User', body: "GPTBot alimente l'entraînement, OAI-SearchBot la recherche en direct de ChatGPT Search, ChatGPT-User les actions à la demande de l'utilisateur." },
              { title: 'Anthropic — ClaudeBot, Claude-Web, Claude-User', body: "ClaudeBot pour l'entraînement, Claude-Web pour les fonctions de navigation, Claude-User pour les requêtes utilisateur." },
              { title: 'Perplexity — PerplexityBot, Perplexity-User', body: "PerplexityBot indexe en continu, Perplexity-User déclenche un crawl ciblé lors d'une question utilisateur." },
              { title: 'Google — Google-Extended, GoogleOther', body: "Google-Extended contrôle l'usage de votre site pour entraîner Gemini et AI Overviews, distinct du Googlebot classique." },
              { title: 'Autres — Bytespider, Meta-ExternalAgent, Bingbot AI', body: "Bytespider (ByteDance / TikTok), Meta-ExternalAgent (Meta AI), Bingbot pour Copilot." },
            ],
          },
          {
            title: 'Vérifier son robots.txt en deux minutes',
            body: "Téléchargez votre /robots.txt et cherchez chaque user-agent listé ci-dessus. Un Disallow: / appliqué à GPTBot ou ClaudeBot bloque toute citation future par ChatGPT ou Claude. C'est l'erreur la plus fréquente sur les sites WordPress et Shopify par défaut.",
          },
          {
            title: 'Stratégie : ouvrir, limiter ou bloquer ?',
            body: "Pour un site B2B ou éditorial, ouvrir tous les bots IA officiels est généralement gagnant : plus de visibilité, peu de risque. Pour un e-commerce premium ou un site éditorial à forte valeur, on peut autoriser le crawl temps réel (OAI-SearchBot, PerplexityBot, ChatGPT-User) tout en bloquant l'entraînement (GPTBot, Google-Extended).",
          },
        ],
      },
      {
        h2: "Tracker les visites de bots IA dans vos logs",
        h3s: [
          { title: "Pourquoi un audit ponctuel ne suffit pas", body: "Vérifier robots.txt confirme l'intention, pas la réalité. Pour savoir si les bots passent vraiment, il faut analyser les logs serveur ou installer un traceur léger côté Cloudflare ou serveur." },
          { title: "Reconnaître les bots furtifs et les usurpations", body: "Certains bots se déclarent GPTBot sans appartenir à OpenAI. Notre vérification multi-couches (rDNS + ASN officiels) classe chaque visite en Vérifié, Suspect ou Furtif." },
          { title: "Mesurer la fréquence et la profondeur de crawl", body: "Un bot IA qui visite votre page d'accueil tous les jours mais jamais vos articles est un signal d'alerte : votre maillage interne ne distribue pas l'autorité jusqu'aux pages stratégiques." },
        ],
      },
    ],
    faqs: [
      { q: "Comment savoir si GPTBot a accès à mon site ?", a: "Téléchargez votre /robots.txt et cherchez 'GPTBot'. S'il n'y a aucune ligne 'Disallow' qui lui est appliquée, l'accès est ouvert. Sinon, supprimez ou ajustez la directive." },
      { q: "Bloquer GPTBot empêche-t-il d'être cité par ChatGPT ?", a: "Partiellement. GPTBot alimente l'entraînement. Pour ChatGPT Search en revanche, c'est OAI-SearchBot qui crawl en direct : il faut l'autoriser séparément." },
      { q: "Faut-il créer un fichier llms.txt ?", a: "Recommandé. Placé à la racine du site, /llms.txt résume votre offre, vos pages clés et vos consignes aux LLM. Plusieurs moteurs commencent à le lire en priorité." },
      { q: "Les bots IA pèsent-ils sur les performances serveur ?", a: "Marginalement pour un site standard, significativement pour un gros e-commerce. Si la charge devient problématique, limitez la fréquence via Crawl-Delay ou rate-limiting Cloudflare plutôt que de bloquer totalement." },
    ],
    datePublished: '2026-04-08',
  },

  'observatoire': {
    primaryKeyword: 'observatoire SEO sectoriel',
    secondaryKeywords: ['benchmark seo', 'analyse concurrentielle seo', 'observatoire référencement', 'seo sectoriel', 'tendances seo'],
    persona: {
      title: 'Pour qui ?',
      body: "Directions marketing, agences et consultants qui veulent comparer leur performance SEO et GEO à la moyenne réelle de leur secteur — pas à des benchmarks publics génériques.",
      bullets: [
        "Directions marketing qui doivent justifier leur budget SEO",
        "Agences qui pitchent un nouveau client avec un benchmark sectoriel",
        "Consultants qui veulent prouver l'écart de performance",
        "Fondateurs SaaS qui surveillent leur catégorie",
      ],
    },
    sections: [
      {
        h2: 'Pourquoi un observatoire sectoriel change la donne',
        intro: "Les benchmarks SEO publics moyennent tout : un site média et un e-commerce niche n'ont rien à voir. L'observatoire Crawlers calcule des médianes par secteur d'activité sur un panel réel de sites audités, en SEO et en GEO.",
        h3s: [
          { title: 'Comparer ce qui est comparable', body: "Score GEO médian, Score E-E-A-T médian, vitesse mobile médiane, taux de citation LLM médian : chaque KPI est segmenté par catégorie (e-commerce mode, SaaS B2B, cabinet d'avocats, restaurant, artisan…)." },
          { title: 'Détecter les écarts qui valent un budget', body: "Si votre Score GEO est à 42 alors que la médiane de votre secteur est à 67, le diagnostic est immédiat et l'arbitrage budgétaire devient simple. Sans benchmark sectoriel, ce raisonnement n'est pas possible." },
          { title: 'Suivre les tendances de fond', body: "L'observatoire publie des snapshots hebdomadaires. Nous mesurons par exemple que le score GEO médian du secteur juridique a progressé de 12 points entre janvier et avril 2026 — un signal d'accélération concurrentielle." },
        ],
      },
      {
        h2: "Méthodologie de l'observatoire Crawlers",
        h3s: [
          { title: 'Panel et fréquence', body: "Plus de 12 000 sites audités, classés par secteur via un algorithme d'identité (analyse du contenu, des entités citées, du business model). Snapshot hebdomadaire (lundi 06h)." },
          { title: 'KPI mesurés', body: "Score GEO, Score SEO V2, E-E-A-T algorithmique, LCP / CLS / INP médians, taux de citation LLM sur panel de questions catégorielles, profondeur de crawl moyenne." },
          { title: 'Confidentialité', body: "Les médianes sectorielles n'exposent jamais les sites individuels. Aucune donnée client n'est partagée nominativement dans les benchmarks publics." },
        ],
      },
    ],
    faqs: [
      { q: "Combien de secteurs sont couverts ?", a: "Plus de 40 catégories, du e-commerce mode au cabinet d'avocats en passant par les SaaS B2B, les restaurants et les artisans du BTP." },
      { q: "À quelle fréquence les benchmarks sont-ils mis à jour ?", a: "Snapshot hebdomadaire chaque lundi à 06h. Les médianes annuelles sont également disponibles pour suivre les tendances longues." },
      { q: "Mon site contribue-t-il au benchmark de mon secteur ?", a: "Oui de manière anonymisée. Aucun site n'est identifiable dans les médianes publiques." },
      { q: "L'observatoire est-il accessible gratuitement ?", a: "Les médianes principales sont consultables gratuitement. Le benchmark détaillé par sous-segment est inclus dans le plan Pro Agency." },
    ],
    datePublished: '2026-04-08',
  },

  /* ─────────── BLOC AUDIT ─────────── */
  'audit-expert': {
    primaryKeyword: 'audit SEO expert',
    secondaryKeywords: ['audit seo', 'audit seo gratuit', 'audit technique seo', 'audit site web', 'seo audit', 'comment faire un audit seo', 'analyse seo', 'seo checker'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables SEO, freelances et agences qui veulent un audit SEO et GEO complet, livré en moins de deux minutes, avec un plan d'action priorisé plutôt qu'une checklist générique.",
      bullets: [
        'Freelances SEO qui livrent un audit à un nouveau client',
        'Responsables marketing qui valident la santé SEO avant refonte',
        'Agences qui standardisent leur audit d\'entrée',
        'Fondateurs qui veulent un diagnostic avant d\'engager un consultant',
      ],
    },
    sections: [
      {
        h2: 'Ce que mesure un audit SEO expert en 2026',
        intro: "Un audit SEO moderne ne se limite plus aux balises title et au robots.txt. Il croise quatre dimensions : la santé technique, la qualité éditoriale, l'autorité E-E-A-T et la visibilité GEO dans les moteurs génératifs.",
        h3s: [
          {
            title: 'Audit technique : la fondation',
            body: "Crawl complet, codes HTTP, redirections, balisage canonical, hreflang, données structurées, Core Web Vitals, robots.txt, sitemap, indexabilité.",
            h4s: [
              { title: 'Maillage interne et profondeur de crawl', body: "Pages orphelines, profondeur excessive (>4 clics), liens cassés, distribution du PageRank interne." },
              { title: 'Vitesse mobile et Core Web Vitals', body: "LCP, INP, CLS sur 75e percentile, identifiés via PageSpeed Insights et CrUX." },
            ],
          },
          {
            title: 'Audit éditorial : la valeur perçue',
            body: "Couverture sémantique du cocon principal, profondeur des contenus, fraîcheur, qualité des titres, présence d'éléments citables (statistiques, citations, blockquotes).",
          },
          {
            title: 'Audit E-E-A-T et GEO',
            body: "Auteur identifié, mentions externes, balisage Organization, signaux de fraîcheur, accessibilité aux bots IA, présence dans les réponses ChatGPT et Perplexity sur un panel de questions.",
          },
        ],
      },
      {
        h2: "Combien coûte et combien de temps prend un audit SEO",
        h3s: [
          { title: 'Combien coûte un audit SEO ?', body: "Un audit manuel par une agence coûte généralement entre 1 500 € et 8 000 € selon la profondeur. L'audit expert Crawlers est gratuit pour une URL, et inclus dans le plan Pro Agency pour un suivi multi-sites continu." },
          { title: 'Combien de temps prend un audit SEO ?', body: "Comptez 1 à 3 semaines pour un audit manuel agence, 90 à 120 secondes pour un audit Crawlers automatisé. Le résultat est immédiatement actionnable, classé par impact." },
          { title: 'Quand refaire un audit ?', body: "À chaque refonte, à chaque mise à jour majeure de Google ou de OpenAI/Anthropic, et au minimum une fois par trimestre pour les sites stratégiques." },
        ],
      },
    ],
    faqs: [
      { q: "Comment faire un audit SEO soi-même ?", a: "Lancez l'audit expert Crawlers (gratuit), exportez le rapport, traitez d'abord les correctifs marqués Impact élevé (technique bloquant, indexabilité, E-E-A-T critique), puis les Impact moyen (sémantique, maillage)." },
      { q: "Pourquoi faire un audit SEO et GEO conjoint ?", a: "Parce que les correctifs se chevauchent : structurer un H1-H4 propre améliore le SEO et le GEO. Les traiter séparément double le coût." },
      { q: "L'audit Crawlers remplace-t-il Screaming Frog ou OnCrawl ?", a: "Pour un audit de découverte oui. Pour un crawl industriel de plus de 50 000 URL avec exports CSV avancés, ces outils restent complémentaires." },
      { q: "Mon audit est-il partageable avec un client ?", a: "Oui. Chaque audit génère un rapport partageable par lien (HTML public ou PDF), avec en option un mode white-label sur le plan Pro Agency." },
    ],
    datePublished: '2026-04-08',
  },

  'machine-layer-scanner': {
    primaryKeyword: 'machine layer scanner',
    secondaryKeywords: ['json-ld', 'schema.org', 'opengraph', 'meta tags', 'llms.txt', 'données structurées seo', 'audit meta'],
    persona: {
      title: 'Pour qui ?',
      body: "Développeurs, intégrateurs et responsables SEO techniques qui veulent valider en un clic l'intégralité de la couche machine : meta, OpenGraph, JSON-LD, robots.txt, llms.txt, headers.",
      bullets: [
        'Développeurs front qui livrent une nouvelle page',
        'Intégrateurs qui valident un template avant déploiement',
        'SEO techniques qui auditent un site WordPress ou Shopify',
        'Consultants qui contrôlent la mise en production',
      ],
    },
    sections: [
      {
        h2: "Qu'est-ce que la couche machine d'un site",
        intro: "La couche machine regroupe tous les signaux que vos visiteurs ne voient pas mais que les moteurs (Google, Bing, ChatGPT, Claude) lisent en priorité : meta, OpenGraph, Twitter Card, JSON-LD, balisage Schema.org, robots.txt, llms.txt, headers HTTP.",
        h3s: [
          {
            title: 'Les signaux à auditer absolument',
            body: "Une couche machine défaillante peut diviser par deux la performance SEO d'une page parfaite éditorialement.",
            h4s: [
              { title: 'Meta title et description', body: "Longueur, unicité, présence du mot-clé principal, cohérence avec H1." },
              { title: 'OpenGraph et Twitter Card', body: "og:title, og:description, og:image (1200×630), og:type, og:url. Indispensable pour LinkedIn, Slack, Discord, X." },
              { title: 'JSON-LD Schema.org', body: "Article, Organization, BreadcrumbList, FAQPage, Product, HowTo selon le type de page." },
              { title: 'robots.txt et llms.txt', body: "Aucun Disallow sur les pages stratégiques, accès ouvert aux bots IA officiels, llms.txt à la racine." },
              { title: 'Headers HTTP', body: "X-Robots-Tag, Cache-Control, Content-Security-Policy compatibles SEO." },
            ],
          },
          { title: 'Comment Crawlers scanne votre page', body: "Le scanner télécharge la page rendue (DOM final, JS exécuté), parse chaque signal, le confronte aux référentiels Schema.org et OpenGraph et restitue un score par bloc avec les correctifs prêts à coller." },
        ],
      },
      {
        h2: "Erreurs fréquentes sur la couche machine",
        h3s: [
          { title: "JSON-LD invalide ou vide", body: "Le balisage existe mais comporte des erreurs de syntaxe, des @type inexistants ou des propriétés requises manquantes. Google ignore alors complètement le bloc." },
          { title: "OpenGraph non rendu côté SSR", body: "Sur les sites React/Vue sans SSR, og:* injecté par JS n'est pas vu par les social-preview crawlers (LinkedIn, Slack). Le partage affiche un aperçu vide." },
          { title: "robots.txt qui bloque les bots IA par défaut", body: "Plusieurs CMS bloquent GPTBot ou ClaudeBot par défaut dans leur configuration sécurité, sans que l'éditeur en soit informé." },
        ],
      },
    ],
    faqs: [
      { q: "Le scanner analyse-t-il toutes les pages ou une seule ?", a: "Une URL par scan en version gratuite. Le plan Pro Agency permet de scanner tout le site en mode batch." },
      { q: "Les correctifs sont-ils prêts à copier-coller ?", a: "Oui. Chaque problème détecté propose le code JSON-LD ou la balise meta corrigée, prête à intégrer dans WordPress, Webflow, Shopify ou un framework custom." },
      { q: "Pourquoi mon JSON-LD ne s'affiche pas dans Google ?", a: "Trois causes : syntaxe invalide, @type non reconnu, propriétés requises absentes. Le scanner identifie laquelle des trois s'applique." },
    ],
    datePublished: '2026-04-08',
  },

  'eeat': {
    primaryKeyword: 'E-E-A-T SEO',
    secondaryKeywords: ['eeat', 'e-e-a-t', 'eeat google', 'eeat seo', 'critères eeat', 'expérience expertise autorité fiabilité', 'eeat google search central'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables éditoriaux, consultants SEO et agences qui veulent mesurer objectivement les signaux E-E-A-T de leurs pages — au-delà des opinions et des checklists subjectives.",
      bullets: [
        'Éditeurs YMYL (santé, finance, juridique) soumis à exigence E-E-A-T élevée',
        "Consultants SEO qui auditent l'autorité d'un client",
        'Responsables marketing B2B qui veulent crédibiliser leurs pages',
        'Agences qui white-label un score E-E-A-T pour leurs reportings',
      ],
    },
    sections: [
      {
        h2: "Comprendre les quatre piliers E-E-A-T",
        intro: "E-E-A-T signifie Experience, Expertise, Authoritativeness, Trustworthiness — les quatre signaux que Google utilise depuis 2022 pour évaluer la qualité d'une page, particulièrement sur les sujets YMYL.",
        h3s: [
          {
            title: "Les quatre piliers détaillés",
            body: "Chaque pilier se mesure via des signaux on-page (auteur, bio, dates) et off-page (mentions, backlinks, profils tiers).",
            h4s: [
              { title: 'Experience — Expérience vécue', body: "L'auteur a-t-il réellement utilisé le produit ou vécu la situation décrite ? Signal récent (2022), particulièrement valorisé sur les reviews et les guides pratiques." },
              { title: 'Expertise — Expertise du sujet', body: "Diplômes, années d'expérience, publications, certifications. Doit être démontrable, pas déclarative." },
              { title: "Authoritativeness — Autorité reconnue", body: "Citations par des sources tierces fiables, présence dans Wikipedia, mentions dans la presse spécialisée, backlinks éditoriaux." },
              { title: 'Trustworthiness — Fiabilité', body: "HTTPS, mentions légales, politique de confidentialité, dates de mise à jour, sources citées, absence de désinformation." },
            ],
          },
          { title: "Le scoring E-E-A-T algorithmique", body: "Crawlers V3 analyse 38 signaux on-page (auteur structuré, JSON-LD Person, dates ISO, sources citées, profondeur éditoriale, ratio texte/CTA) et restitue un score par pilier sur 100, avec les correctifs classés par effort/impact." },
        ],
      },
      {
        h2: "Améliorer son score E-E-A-T en pratique",
        h3s: [
          { title: 'Identifier et baliser ses auteurs', body: "Chaque article doit avoir un auteur identifié avec bio, photo, profils sociaux et JSON-LD Person. Sur les sujets YMYL, mentionner les diplômes et certifications." },
          { title: 'Citer ses sources avec dates', body: "Toute statistique ou affirmation factuelle doit être sourcée. Les LLM extraient en priorité les passages avec citation explicite et date." },
          { title: "Construire l'autorité externe", body: "Demander à être cité dans des articles tiers, intervenir dans des podcasts spécialisés, publier sur des plateformes communautaires reconnues (Medium, Substack, LinkedIn Pulse)." },
        ],
      },
    ],
    faqs: [
      { q: "Qu'est-ce que l'E-E-A-T en SEO ?", a: "E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) est le cadre d'évaluation qualité de Google. Il influence directement le classement, particulièrement sur les pages YMYL (santé, finance, juridique)." },
      { q: "L'E-E-A-T est-il un facteur de classement direct ?", a: "Non strictement, mais oui indirectement. Les Quality Raters Guidelines de Google l'utilisent comme grille d'évaluation, et les algorithmes sont entraînés à approximer ces évaluations." },
      { q: "Comment mesurer son E-E-A-T ?", a: "Via un score algorithmique multi-signaux comme celui de Crawlers, qui parse l'auteur, les sources, les dates, le balisage Person et les mentions externes pour produire une note par pilier." },
      { q: "L'E-E-A-T compte-t-il pour les LLM ?", a: "Oui, fortement. Les moteurs génératifs (ChatGPT, Perplexity, AI Overviews) privilégient les sources démontrant expérience et autorité dans leurs synthèses." },
    ],
    datePublished: '2026-04-08',
  },

  'app/site-crawl': {
    primaryKeyword: 'crawl SEO',
    secondaryKeywords: ['screaming frog', 'crawling', 'crawler web', 'oncrawl', 'seo screaming frog', 'crawl budget', 'crawl depth', 'audit technique seo'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables SEO techniques, intégrateurs et agences qui veulent un crawl rapide, exhaustif et lisible — sans installer de logiciel de bureau ni configurer un serveur.",
      bullets: [
        'Responsables SEO techniques qui scannent leur site régulièrement',
        'Agences qui crawlent un nouveau client en deux clics',
        'Développeurs qui valident une refonte page par page',
        'Consultants qui livrent un rapport de crawl chiffré',
      ],
    },
    sections: [
      {
        h2: "Pourquoi crawler son site régulièrement",
        intro: "Le crawl SEO consiste à simuler le passage d'un moteur de recherche sur l'intégralité d'un site pour détecter les pages cassées, les redirections, les contenus dupliqués, les balises manquantes et les problèmes de maillage interne.",
        h3s: [
          { title: 'Détecter les pages orphelines', body: "Une page orpheline n'est liée par aucune autre page du site. Elle est rarement indexée, jamais correctement classée. Le crawl identifie ces orphelins en comparant le sitemap aux liens internes effectifs." },
          { title: 'Mesurer le crawl depth', body: "La profondeur de crawl (clics depuis la home) doit rester inférieure à 4 pour les pages stratégiques. Au-delà, Google et les bots IA réduisent leur fréquence de visite, et l'autorité interne ne se distribue plus." },
          { title: 'Surveiller les codes HTTP et redirections', body: "Une chaîne de redirections 301→302→200 dilue le PageRank et ralentit l'expérience utilisateur. Le crawl liste ces chaînes et propose les corrections vers du 301 direct." },
        ],
      },
      {
        h2: "Crawlers vs Screaming Frog vs OnCrawl",
        h3s: [
          { title: 'Crawlers — cloud, instantané, multi-sites', body: "Aucune installation. Crawl déclenché en un clic depuis le navigateur. Résultats visualisés directement avec scoring SEO et GEO intégré. Idéal pour les audits récurrents et le suivi multi-sites." },
          { title: "Screaming Frog — desktop, profond, expert", body: "Logiciel desktop puissant pour les audits techniques approfondis (>50k URL). Configuration avancée, mais nécessite une machine performante et une licence payante au-delà de 500 URL." },
          { title: 'OnCrawl — enterprise, logs, big data', body: "Plateforme SaaS enterprise spécialisée dans l'analyse croisée crawl + logs serveur. Adapté aux très gros sites e-commerce et médias." },
        ],
      },
    ],
    faqs: [
      { q: "Combien de pages Crawlers peut-il crawler ?", a: "1 000 pages en plan gratuit, 5 000 en Pro Agency, jusqu'à 50 000 en mode entreprise. Le crawl utilise un sémaphore parallélisé pour rester rapide même sur les gros volumes." },
      { q: "Le crawl impacte-t-il les performances de mon site ?", a: "Marginalement. Le crawl Crawlers respecte un rate limit ajusté à la capacité du serveur cible et obéit au Crawl-Delay du robots.txt." },
      { q: "Quels critères analyse le crawl SEO ?", a: "Codes HTTP, redirections, balises title/description/H1, canonical, hreflang, JSON-LD, profondeur, pages orphelines, liens cassés, ratio HTML/contenu, vitesse de réponse." },
      { q: "À quelle fréquence faut-il crawler son site ?", a: "Mensuel pour un site standard, hebdomadaire pour un e-commerce ou un média à fort renouvellement éditorial, immédiat après chaque mise en production majeure." },
    ],
    datePublished: '2026-04-08',
  },

  'pagespeed': {
    primaryKeyword: 'Core Web Vitals',
    secondaryKeywords: ['pagespeed insights', 'test vitesse site', 'lcp inp cls', 'web vitals', 'comment améliorer core web vitals', 'page speed insight'],
    persona: {
      title: 'Pour qui ?',
      body: "Développeurs, intégrateurs et SEO techniques qui veulent un diagnostic Core Web Vitals immédiat, avec les correctifs priorisés par impact réel sur le score Google.",
      bullets: [
        'Développeurs front qui auditent leur build',
        "Intégrateurs qui livrent un thème ou un template",
        'SEO techniques qui justifient un sprint perfo',
        'Responsables produit qui surveillent la vitesse mobile',
      ],
    },
    sections: [
      {
        h2: "Comprendre les Core Web Vitals 2026",
        intro: "Les Core Web Vitals sont les trois métriques officielles de Google qui mesurent l'expérience utilisateur réelle : LCP (chargement), INP (réactivité), CLS (stabilité visuelle). Ils influencent directement le classement, particulièrement sur mobile.",
        h3s: [
          {
            title: 'Les trois métriques à surveiller',
            body: "Chaque métrique a un seuil Bon, À améliorer et Médiocre. Pour être classé Bon Google, les trois doivent être verts simultanément.",
            h4s: [
              { title: 'LCP — Largest Contentful Paint', body: "Temps avant l'affichage du plus gros élément visible. Cible : < 2,5 s. Souvent dégradé par une image hero non optimisée, des fonts bloquantes ou du JavaScript critique." },
              { title: 'INP — Interaction to Next Paint', body: "Délai de réaction après une interaction utilisateur. Cible : < 200 ms. Remplace FID depuis mars 2024. Dégradé par les long tasks JavaScript et les third-party scripts." },
              { title: 'CLS — Cumulative Layout Shift', body: "Stabilité visuelle pendant le chargement. Cible : < 0,1. Dégradé par les images sans dimensions explicites, les fonts qui changent en cours de chargement, les bannières insérées dynamiquement." },
            ],
          },
          { title: "Données field vs données lab", body: "PageSpeed Insights affiche deux sources : les données field (CrUX, mesures utilisateurs réels sur 28 jours) et les données lab (Lighthouse, simulation contrôlée). Google classe sur les données field." },
        ],
      },
      {
        h2: "Comment améliorer ses Core Web Vitals",
        h3s: [
          { title: 'Optimiser le LCP', body: "Compresser et servir l'image hero en WebP/AVIF avec srcset, préloader la ressource LCP, supprimer les fonts bloquantes (font-display: swap), reporter le JavaScript non critique." },
          { title: "Réduire l'INP", body: "Diviser les long tasks (>50 ms), différer les third-party scripts (Tag Manager, analytics) après la première interaction, alléger le bundle JS, utiliser web workers pour les calculs lourds." },
          { title: 'Stabiliser le CLS', body: "Déclarer width/height sur toutes les images et iframes, réserver l'espace pour les bannières et ads, précharger les fonts critiques, éviter les insertions de contenu au-dessus du fold après chargement." },
        ],
      },
    ],
    faqs: [
      { q: "Comment tester ses Core Web Vitals gratuitement ?", a: "Utilisez PageSpeed Insights ou le dashboard PageSpeed Crawlers (gratuit) qui agrège LCP, INP, CLS avec recommandations contextualisées et historique." },
      { q: "Les Core Web Vitals sont-ils un facteur de classement ?", a: "Oui, depuis le Page Experience Update de 2021. L'impact est modéré mais réel, surtout en cas d'égalité de pertinence entre deux pages." },
      { q: "Quelle métrique prioriser : LCP, INP ou CLS ?", a: "Celle qui est rouge dans vos données field. À défaut, prioriser le LCP qui a généralement l'impact perçu le plus fort sur la conversion." },
      { q: "Pourquoi mon score Lighthouse diffère du score field ?", a: "Lighthouse simule un appareil moyen sur réseau lent. Les données field reflètent vos vrais utilisateurs. C'est le score field qui compte pour Google." },
    ],
    datePublished: '2026-04-08',
  },

  'matrice': {
    primaryKeyword: 'matrice audit SEO',
    secondaryKeywords: ['comparatif audit seo', 'scoring multi-critères seo', 'tableau de bord seo', 'matrice eeat', 'comparaison audits'],
    persona: {
      title: 'Pour qui ?',
      body: "Consultants et agences qui doivent comparer plusieurs audits dans le temps ou plusieurs sites entre eux, avec un format matriciel exportable et lisible par un comité de direction.",
      bullets: [
        'Consultants qui présentent un avant/après à un client',
        'Agences qui benchmarkent plusieurs clients en interne',
        'Directions marketing qui veulent un tableau de bord exécutif',
        'Auditeurs qui certifient la progression mois après mois',
      ],
    },
    sections: [
      {
        h2: "Le format matriciel pour l'audit SEO",
        intro: "La matrice d'audit organise les critères SEO en familles (Technique, Sémantique, E-E-A-T, GEO, Performance) et chaque ligne en page ou en site. Chaque cellule porte un score 0-100, une heatmap couleur et un delta vs l'audit précédent.",
        h3s: [
          { title: 'Comparer deux audits dans le temps', body: "Choisissez un audit de référence (T0) et un audit récent (T1). La matrice affiche les progressions et régressions par famille de critères, avec un calcul de delta global pondéré." },
          { title: 'Comparer plusieurs sites entre eux', body: "Sur le plan Pro Agency, comparez jusqu'à 30 sites sur la même matrice de critères. Identifiez en un coup d'œil les sites qui sous-performent sur l'E-E-A-T ou le GEO." },
          { title: "Exporter en CSV, PDF ou présentation", body: "La matrice s'exporte en CSV (pour Excel/Sheets), en PDF section-based (rapport partageable) ou en présentation HTML pour comités de pilotage." },
        ],
      },
    ],
    faqs: [
      { q: "Combien d'audits peut-on comparer ?", a: "Deux audits côte à côte en plan gratuit, jusqu'à 12 audits dans une matrice temporelle sur Pro Agency." },
      { q: "Les critères de la matrice sont-ils personnalisables ?", a: "Oui sur Pro Agency. Vous pouvez activer/désactiver des familles et ajuster les pondérations selon votre méthodologie d'agence." },
    ],
    datePublished: '2026-04-08',
  },

  'audit-semantique': {
    primaryKeyword: 'audit sémantique',
    secondaryKeywords: ['cocon sémantique', 'analyse sémantique seo', 'champ lexical seo', 'yourtextguru', 'couverture sémantique', 'mots-clés sémantiques'],
    persona: {
      title: 'Pour qui ?',
      body: "Rédacteurs SEO, content managers et stratèges éditoriaux qui veulent mesurer la couverture sémantique réelle de leurs pages — pas seulement la densité de mots-clés.",
      bullets: [
        'Rédacteurs SEO qui optimisent un article existant',
        'Content managers qui briefent un freelance',
        "Stratèges éditoriaux qui structurent un cocon",
        'Agences qui livrent un audit éditorial chiffré',
      ],
    },
    sections: [
      {
        h2: "Qu'est-ce qu'un audit sémantique en SEO",
        intro: "L'audit sémantique mesure dans quelle proportion une page couvre le champ lexical attendu par Google pour une requête cible. Une page peut contenir le mot-clé exact 50 fois et rater son sujet si elle néglige les termes connexes attendus.",
        h3s: [
          { title: 'Lexique attendu vs lexique présent', body: "Pour chaque requête cible, nous extrayons le lexique des 10 premiers résultats Google et le comparons au lexique présent dans votre page. L'écart constitue votre déficit sémantique." },
          { title: "Score de couverture et termes prioritaires", body: "Score 0-100, liste des termes manquants classés par fréquence dans le top 10, suggestions de reformulation et de paragraphes à ajouter." },
          { title: 'Intégration au cocon sémantique', body: "L'audit sémantique alimente directement le cocon (page mère et pages filles). Une page mère doit couvrir le champ large, chaque page fille doit creuser un sous-champ avec son propre lexique attendu." },
        ],
      },
    ],
    faqs: [
      { q: "Quelle différence entre densité de mots-clés et couverture sémantique ?", a: "La densité compte un mot-clé exact. La couverture sémantique mesure l'ensemble du champ lexical (synonymes, entités, termes connexes) attendu par Google pour le sujet." },
      { q: "L'audit sémantique remplace-t-il YourTextGuru ?", a: "Pour les usages courants oui. YourTextGuru reste pertinent pour des analyses très approfondies avec corpus personnalisés." },
      { q: "Combien de pages auditer en sémantique ?", a: "Toutes les pages qui ciblent une requête concurrentielle. Pour un cocon, auditez la page mère et les 5 à 10 pages filles principales." },
    ],
    datePublished: '2026-04-08',
  },

  /* ─────────── BLOC ARCHITECTE ─────────── */
  'features/cocoon': {
    primaryKeyword: 'cocon sémantique',
    secondaryKeywords: ['cocon sémantique seo', 'cocon sémantique exemple', 'cocon sémantique wordpress', 'silo seo', 'maillage interne seo', 'comment créer un cocon sémantique', 'formation cocon sémantique'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables éditoriaux, freelances SEO et agences qui veulent construire ou auditer un cocon sémantique sans tableau Excel ni outil de mind-mapping séparé.",
      bullets: [
        'Responsables éditoriaux qui structurent un nouveau site',
        'Freelances SEO qui livrent une architecture cocon',
        'Agences qui auditent le maillage interne',
        'Fondateurs SaaS qui veulent dominer un cluster thématique',
      ],
    },
    sections: [
      {
        h2: "Le cocon sémantique en 2026",
        intro: "Le cocon sémantique, théorisé par Laurent Bourrelly, organise les pages d'un site en arborescence thématique : une page mère sur le sujet large, des pages filles sur les sous-sujets, des pages petites-filles sur les requêtes longues. Le maillage interne propage l'autorité de la mère vers les filles.",
        h3s: [
          {
            title: "Anatomie d'un cocon sémantique",
            body: "Un cocon comprend trois niveaux : la page mère (cluster head), les pages filles (cluster pages), les pages petites-filles (long-tail). Le maillage descend (mère vers filles) et remonte (filles vers mère) avec des ancres optimisées.",
            h4s: [
              { title: 'Page mère (pillar page)', body: "Cible la requête large à fort volume. Couverture sémantique exhaustive. Lie chaque page fille avec une ancre exacte." },
              { title: 'Pages filles (cluster pages)', body: "Cible chaque sous-sujet avec sa propre couverture. Lie vers la mère et les pages sœurs pertinentes." },
              { title: 'Pages petites-filles', body: "Cible des requêtes longues (>4 mots). Lie vers la page fille parente uniquement." },
            ],
          },
          { title: "Comment Crawlers construit un cocon", body: "Notre moteur Cocoon V3 scanne votre site, identifie les clusters thématiques existants, détecte les cannibalisations (deux pages qui ciblent la même requête) et propose une nouvelle arborescence avec ancres optimisées." },
          { title: 'Audit du maillage existant', body: "Visualisation 3D du graphe complet du site, X-Ray mode pour identifier les pages mal liées, calcul de l'autorité interne distribuée par page." },
        ],
      },
      {
        h2: "Cocon sémantique : exemples et bonnes pratiques",
        h3s: [
          { title: "Combien d'articles dans un cocon ?", body: "Un cocon viable comprend au minimum 1 page mère + 5 pages filles. Idéal : 1 mère + 10 à 20 filles + petites-filles selon le volume de longue traîne." },
          { title: 'Cocon sémantique sur WordPress', body: "Sur WordPress, le cocon se matérialise par une catégorie pillar + des articles fils. Plugins comme Yoast permettent de baliser cornerstone content, mais ne génèrent pas le maillage automatique." },
          { title: 'Pièges à éviter', body: "Cannibalisation entre pages filles, ancres internes toutes identiques, page mère trop générique sans angle propre, absence de remontée fille → mère." },
        ],
      },
    ],
    faqs: [
      { q: "Comment créer un cocon sémantique ?", a: "Identifiez la requête large (page mère), listez les sous-requêtes (pages filles), rédigez chaque page avec couverture sémantique propre, maillez de la mère vers chaque fille et de chaque fille vers la mère." },
      { q: "Quelle différence entre silo et cocon sémantique ?", a: "Le silo est une structure rigide d'URL (/categorie/sous-categorie/page). Le cocon est un maillage thématique qui se passe de structure d'URL stricte." },
      { q: "Le cocon sémantique fonctionne-t-il toujours en 2026 ?", a: "Oui, et il devient encore plus utile pour le GEO. Les LLM comprennent les regroupements thématiques cohérents et citent plus volontiers les sites qui démontrent une expertise structurée." },
      { q: "Combien de temps pour qu'un cocon donne des résultats ?", a: "Comptez 3 à 6 mois sur des requêtes concurrentielles. Les pages petites-filles se positionnent plus vite (4 à 8 semaines) et tirent ensuite les pages filles puis la mère." },
    ],
    datePublished: '2026-04-08',
  },

  'content-architect': {
    primaryKeyword: 'génération contenu SEO IA',
    secondaryKeywords: ['rédaction seo ia', 'content brief automatique', 'pipeline éditoriale ia', 'génération article seo', 'content architect'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables éditoriaux et agences qui veulent industrialiser la production de contenu SEO/GEO avec un pipeline rigoureux : brief stratégique, rédaction, tonalisation, publication CMS.",
      bullets: [
        'Responsables éditoriaux qui publient plusieurs articles par semaine',
        'Agences qui produisent du contenu pour plusieurs clients',
        'Fondateurs SaaS qui veulent dominer un cocon en quelques mois',
        "Consultants qui automatisent leur livrable éditorial",
      ],
    },
    sections: [
      {
        h2: "Le pipeline éditorial Content Architect",
        intro: "Content Architect orchestre quatre étapes successives pour produire un article SEO/GEO calibré : briefing stratégique, rédaction, tonalisation à la marque, publication CMS. Chaque étape utilise un modèle LLM différent, optimisé pour sa tâche.",
        h3s: [
          {
            title: 'Les quatre étapes du pipeline',
            body: "Aucune étape ne peut être sautée : la qualité finale dépend du briefing initial.",
            h4s: [
              { title: '1. Briefing déterministe', body: "ContentBrief calcule le type de page, l'angle, le persona ciblé, les mots-clés primaires/secondaires, les liens internes prescrits, le CTA et le schema JSON-LD à injecter." },
              { title: '2. Stratège', body: "Plan détaillé de l'article : H1, H2, H3, intro, conclusion, FAQ, passages citables. Validation de la couverture sémantique." },
              { title: '3. Rédacteur', body: "Production de la version 1 selon le plan, avec contraintes de longueur, de format et de balisage." },
              { title: '4. Tonalisateur', body: "Réécriture finale à la voix de marque (Brand Voice DNA extraite des contenus existants). Garantit la cohérence éditoriale." },
            ],
          },
          { title: 'Publication CMS native', body: "Une fois l'article validé, publication directe en WordPress, Webflow, Shopify, Strapi, Sanity, Ghost ou via REST API custom. Le HTML produit inclut tous les balisages requis (JSON-LD, breadcrumb, FAQ schema)." },
        ],
      },
      {
        h2: "Pourquoi un pipeline 4-étapes plutôt qu'un prompt unique",
        h3s: [
          { title: 'Qualité supérieure et reproductible', body: "Un prompt unique produit des articles génériques. Le découpage en étapes spécialisées (avec modèles dédiés) permet d'atteindre une qualité éditoriale comparable à un rédacteur senior, de manière reproductible." },
          { title: "Respect de la voix de marque", body: "Le tonalisateur est entraîné sur vos contenus existants (Brand Voice DNA). Le résultat reste indissociable de votre style — pas de ton IA générique." },
          { title: 'Garde-fous éditoriaux', body: "Anti-cannibalisation (refus de produire deux articles trop similaires), anti-hallucination (sources requises), rotation de personas (chaque cycle cible un persona différent du cocon)." },
        ],
      },
    ],
    faqs: [
      { q: "Content Architect remplace-t-il un rédacteur humain ?", a: "Non. Il produit la version 1 à 80% du chemin. Un éditeur humain valide, ajuste les exemples concrets et signe l'article. La productivité est multipliée par 4 à 6." },
      { q: "Sur quels CMS publie Content Architect ?", a: "WordPress (REST API), Webflow, Shopify, Strapi, Sanity, Ghost et tout CMS exposant une REST API custom (configurable via cms-register-api-key)." },
      { q: "Comment éviter le contenu dupliqué ?", a: "Le pipeline inclut une couche dedup synonym-aware (Jaccard overlap), une saturation guard et un blocklist de titres existants." },
    ],
    datePublished: '2026-04-08',
  },

  'breathing-spiral': {
    primaryKeyword: 'SEO autopilote IA',
    secondaryKeywords: ['seo automatisé', 'autopilote seo', 'breathing spiral', 'pilotage seo ia', 'orchestration éditoriale'],
    persona: {
      title: 'Pour qui ?',
      body: "Fondateurs SaaS, responsables marketing et agences qui veulent un pilotage SEO continu et auto-régulé, sans devoir arbitrer manuellement chaque arbitrage consolidation vs expansion.",
      bullets: [
        'Fondateurs SaaS qui veulent croître sans embaucher une équipe SEO',
        'Responsables marketing solo sur leur croissance organique',
        'Agences qui orchestrent plusieurs clients en parallèle',
        "Consultants qui industrialisent leur méthodologie",
      ],
    },
    sections: [
      {
        h2: "La Breathing Spiral : un pilotage homéostatique",
        intro: "La Breathing Spiral est un système d'orchestration SEO qui oscille en continu entre deux phases : consolidation (renforcer ce qui marche déjà) et expansion (créer de nouveaux contenus). Neuf signaux temps réel décident à chaque cycle de la phase active.",
        h3s: [
          { title: 'Pourquoi un système homéostatique', body: "Le SEO classique applique une stratégie linéaire : créer, créer, créer. Cette logique sature rapidement le cocon, génère de la cannibalisation et fait baisser la qualité globale. Un système homéostatique adapte en continu sa stratégie aux signaux du site." },
          {
            title: 'Les 9 signaux temps réel',
            body: "Chaque cycle (hebdomadaire ou quotidien selon le plan) recalcule les signaux et décide de la phase à activer.",
            h4s: [
              { title: 'Signaux de consolidation', body: "Pages en déclin de position, pages avec opportunités d'optimisation, cannibalisations détectées, drops de trafic, pages obsolètes." },
              { title: "Signaux d'expansion", body: "Trous thématiques dans le cocon, requêtes opportunes (volume + faisabilité), gaps vs concurrents, fan-out detection des LLM." },
            ],
          },
          { title: 'Orchestration Parménion', body: "Le moteur Parménion V3 traduit la phase active en plan de 8 tâches concrètes : refresh d'une page, création d'un article, ajout de FAQ, injection de JSON-LD, optimisation de maillage interne, etc." },
        ],
      },
      {
        h2: "Mise en route et garde-fous",
        h3s: [
          { title: "Activation en mode dry-run", body: "Toute nouvelle cible démarre en mode dry-run : le système propose les tâches sans les exécuter. Vous validez ou ajustez avant d'autoriser l'exécution automatique." },
          { title: 'Backlog guard', body: "Si plus de 5 décisions planifiées ne sont pas exécutées sur un site, l'autopilote se met en pause automatique. Pas de file qui s'accumule sans contrôle." },
          { title: 'Validation post-déploiement', body: "Après chaque action, un counter-audit valide que le score SEO/GEO a bien progressé. Si dégradation, rollback proposé." },
        ],
      },
    ],
    faqs: [
      { q: "L'autopilote publie-t-il sans intervention humaine ?", a: "Uniquement si vous avez activé l'exécution automatique. Par défaut, le système est en dry-run et chaque action requiert validation." },
      { q: "Quelle différence avec la génération de masse d'articles IA ?", a: "La génération de masse produit beaucoup, sans cohérence stratégique. La Breathing Spiral produit moins mais juste : chaque action est justifiée par un signal mesurable." },
      { q: "Sur quels plans la Breathing Spiral est-elle disponible ?", a: "Premium et Pro Agency. Le plan gratuit dispose des recommandations stratégiques mais pas de l'exécution automatisée." },
    ],
    datePublished: '2026-04-08',
  },

  'conversion-optimizer': {
    primaryKeyword: 'optimisation taux de conversion',
    secondaryKeywords: ['conversion rate optimization', 'cro audit', 'taux de conversion', 'comment optimiser le taux de conversion', 'optimisation cta', 'conversion optimization'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables marketing, growth et fondateurs qui constatent un bon trafic SEO mais une conversion faible — et veulent un audit CRO contextualisé à leur business model plutôt qu'une checklist générique.",
      bullets: [
        'Responsables marketing SaaS qui optimisent leur funnel',
        'E-commerçants qui veulent passer de 1,5% à 3% de conversion',
        'Fondateurs qui auditent leur landing page avant un lancement',
        'Growth managers qui itèrent sur les CTA et les copies',
      ],
    },
    sections: [
      {
        h2: "Audit CRO contextualisé par IA",
        intro: "Le Conversion Optimizer analyse chaque page importante du site et restitue un diagnostic CRO contextualisé à votre business model (SaaS, e-commerce, lead gen, marketplace) : qualité des CTA, lisibilité, ton, structure de la preuve, hiérarchie de l'information.",
        h3s: [
          { title: "Les dimensions analysées", body: "Hiérarchie visuelle, clarté de la proposition de valeur, force et placement des CTA, ton et registre, lisibilité (longueur de phrases, niveau de lecture), preuve sociale, friction du formulaire, alignement intention/contenu." },
          { title: "Intégration avec Google Analytics 4", body: "Connectez votre propriété GA4 : nous croisons les recommandations CRO avec les vraies métriques comportementales (engagement, scroll depth, taux de rebond par page, conversions par source)." },
          { title: 'Annotations manuelles et heatmap visuelle', body: "Posez des annotations directement sur la capture de page. Visualisez en heatmap les zones à plus fort potentiel d'amélioration." },
        ],
      },
      {
        h2: "Le taux de conversion en 2026",
        h3s: [
          { title: 'Quel est un bon taux de conversion ?', body: "E-commerce : 2-4% médian, 5%+ excellent. SaaS B2B (essai gratuit) : 3-5% sur trafic qualifié. Lead gen B2B : 5-15% sur landing dédiée. Le calcul se fait toujours sur trafic qualifié." },
          { title: "Comment optimiser son taux de conversion ?", body: "Diagnostiquer d'abord (où décrochent les visiteurs ?), formuler une hypothèse, tester une variante (A/B), mesurer sur un volume suffisant, généraliser ou ajuster. Le Conversion Optimizer raccourcit l'étape diagnostic." },
        ],
      },
    ],
    faqs: [
      { q: "Comment optimiser le taux de conversion d'un site ?", a: "Diagnostiquer la friction par page (CTA, copie, preuve), formuler une hypothèse précise, tester en A/B sur un volume suffisant, généraliser le gagnant. L'audit Conversion Optimizer raccourcit la phase diagnostic." },
      { q: "L'outil propose-t-il des A/B tests ?", a: "Il propose les hypothèses et les variantes prêtes à tester. L'exécution A/B se fait dans votre outil dédié (VWO, AB Tasty, Google Optimize remplaçants)." },
      { q: "Quelle différence avec un audit CRO d'agence ?", a: "L'audit Crawlers est instantané et reproductible. Un audit agence apporte de la nuance qualitative humaine. Les deux sont complémentaires sur des sites stratégiques." },
    ],
    datePublished: '2026-04-08',
  },

  'app/social': {
    primaryKeyword: 'gestion réseaux sociaux IA',
    secondaryKeywords: ['planification réseaux sociaux', 'social media management', 'community management ia', 'publication automatique linkedin', 'gestion linkedin meta'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables marketing et community managers qui veulent unifier la publication sur LinkedIn, Meta et X, avec des contenus adaptés à chaque plateforme générés depuis leur cocon SEO.",
      bullets: [
        'Responsables marketing solo qui couvrent plusieurs réseaux',
        'Community managers qui industrialisent la planification',
        'Fondateurs B2B qui veulent une présence LinkedIn régulière',
        'Agences qui gèrent les réseaux de plusieurs clients',
      ],
    },
    sections: [
      {
        h2: "Pourquoi connecter ses réseaux sociaux à son SEO",
        intro: "Les contenus sociaux et les contenus SEO partagent les mêmes sujets, les mêmes personas et la même autorité d'entité. Les connecter dans un seul outil divise par trois la charge de production et garantit la cohérence éditoriale.",
        h3s: [
          { title: 'Du cocon SEO aux posts sociaux', body: "Chaque article publié génère automatiquement les variantes LinkedIn (post long), Meta (visuel + accroche) et X (thread). Le ton est adapté à chaque plateforme, les hashtags pertinents sont suggérés." },
          { title: "Calendrier éditorial unifié", body: "Visualisez en un calendrier le SEO et le social. Identifiez les temps morts, les redondances, les fenêtres optimales de publication par plateforme et fuseau." },
          { title: 'Bibliothèque centralisée et brand voice', body: "Toutes les images générées et tous les textes utilisent la même Brand Voice DNA et la même bibliothèque visuelle. Plus de divergence entre votre site et vos réseaux." },
        ],
      },
    ],
    faqs: [
      { q: "Sur quels réseaux publie l'outil ?", a: "LinkedIn (pages et personnel), Meta (Facebook + Instagram), X (Twitter). Pinterest et TikTok prévus." },
      { q: "Faut-il une intégration OAuth spécifique ?", a: "Oui, chaque réseau requiert un OAuth dédié géré via nos Edge Functions custom (social-oauth-init + social-oauth-callback). Configuration en 2 minutes." },
    ],
    datePublished: '2026-04-08',
  },

  /* ─────────── BLOC CONSOLE & PRO ─────────── */
  'features/console': {
    primaryKeyword: 'console SEO unifiée',
    secondaryKeywords: ['cockpit seo', 'tableau de bord seo geo', 'console seo agence', 'pilotage seo multi-sites', 'plateforme seo intégrée'],
    persona: {
      title: 'Pour qui ?',
      body: "Agences et équipes SEO qui jonglent entre Search Console, GA4, Screaming Frog, OnCrawl, Semrush, des dashboards perso et veulent un cockpit unique pour piloter SEO, GEO, contenu et conversion.",
      bullets: [
        'Responsables SEO agence qui pilotent 5-30 clients',
        'Directions marketing qui veulent un seul tableau de bord',
        "Consultants SEO solo qui industrialisent leur reporting",
        'Équipes growth qui croisent SEO + CRO + analytics',
      ],
    },
    sections: [
      {
        h2: "Un cockpit unique pour SEO, GEO, contenu et conversion",
        intro: "La Console Crawlers réunit 16 modules dans un seul cockpit : audit, crawl, scoring SEO V2, scoring GEO, E-E-A-T, Core Web Vitals, cocon, content architect, autopilote Breathing Spiral, conversion optimizer, observatoire, benchmark SERP multi-providers, bridge SEA→SEO, BigQuery, indexation, concurrence.",
        h3s: [
          { title: "Données natives et données connectées", body: "Crawl, scoring et autopilote sont calculés nativement par Crawlers. Search Console, GA4, Google Ads et Google My Business se connectent via OAuth unifié pour enrichir les métriques." },
          { title: "Benchmark SERP multi-providers", body: "Position de chaque mot-clé suivi mesurée auprès de DataForSEO, SerpApi, Serper et Bright Data, avec moyenne pondérée. Évite la dépendance à un seul fournisseur." },
          { title: 'Bridge SEA → SEO', body: "Importez vos campagnes Google Ads : la console identifie les mots-clés qui convertissent en SEA et pour lesquels vous n'avez pas de page SEO dédiée — opportunités à fort ROI." },
        ],
      },
    ],
    faqs: [
      { q: "Combien de sites peut-on piloter dans la console ?", a: "1 site en plan gratuit, jusqu'à 30 sites sur Pro Agency. Pas de limite stricte sur Premium." },
      { q: "La console remplace-t-elle Google Search Console ?", a: "Non, elle la complète. GSC reste la source officielle Google. La console agrège GSC + GA4 + ses propres mesures pour une vue 360°." },
    ],
    datePublished: '2026-04-08',
  },

  'app/ranking-serp': {
    primaryKeyword: 'suivi positionnement SERP',
    secondaryKeywords: ['suivi position google', 'rank tracking', 'serp tracking', 'benchmark serp', 'position google mots clés'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables SEO et agences qui veulent un suivi de positions fiable, croisé entre plusieurs fournisseurs SERP, sans tomber dans les biais d'un seul scraper.",
      bullets: [
        'Responsables SEO qui suivent 50-500 mots-clés stratégiques',
        'Agences qui produisent un reporting hebdomadaire client',
        'Consultants qui justifient leur valeur ajoutée par les positions',
        'Responsables produit qui surveillent leurs requêtes commerciales',
      ],
    },
    sections: [
      {
        h2: "Pourquoi un benchmark SERP multi-providers",
        intro: "Aucun fournisseur SERP unique n'est parfait : chaque scraper a ses biais (localisation, device, fréquence). Crawlers interroge en parallèle DataForSEO, SerpApi, Serper et Bright Data, puis calcule une position moyenne pondérée — beaucoup plus stable.",
        h3s: [
          { title: 'Mesure quotidienne et historisation', body: "Chaque mot-clé suivi est mesuré quotidiennement (06h UTC). Historique conservé sur 24 mois minimum pour identifier les tendances de fond et les variations algorithmiques." },
          { title: 'Granularité géographique et device', body: "Suivi par pays, par ville et par device (desktop / mobile). Indispensable pour les sites multi-marchés ou les services locaux." },
          { title: 'Alertes et seuils', body: "Configurez des alertes par mot-clé : sortie du top 10, perte de plus de 3 positions en 24h, gain au-dessus d'un seuil. Notifications email ou webhook." },
        ],
      },
    ],
    faqs: [
      { q: "Combien de mots-clés peut-on suivre ?", a: "50 sur Premium, 500 sur Pro Agency, illimité en plan entreprise." },
      { q: "Pourquoi mes positions diffèrent de celles de Search Console ?", a: "GSC reporte la position moyenne sur toutes les requêtes utilisateur réelles (avec personnalisation). Le rank tracker mesure une position contrôlée (localisation, device, sans personnalisation) — plus comparable dans le temps." },
    ],
    datePublished: '2026-04-08',
  },

  'app/console?tab=tracking': {
    primaryKeyword: 'monitoring SEO continu',
    secondaryKeywords: ['monitoring seo', 'surveillance site seo', 'alertes seo', 'détection chute trafic', 'tracking seo automatique'],
    persona: {
      title: 'Pour qui ?',
      body: "Responsables SEO et agences qui veulent être alertés en quasi temps réel sur les régressions critiques : chute de trafic, perte d'indexation, dégradation Core Web Vitals, blocage robots.txt.",
      bullets: [
        'Responsables SEO qui doivent réagir vite aux incidents',
        'Agences qui garantissent un SLA de surveillance',
        'DSI qui surveillent la conformité SEO post-déploiement',
        'Fondateurs qui dorment mieux avec une surveillance active',
      ],
    },
    sections: [
      {
        h2: "Le monitoring SEO continu",
        intro: "Le tracking dépasse la simple position : il surveille la santé globale du site (indexation, accessibilité bots, Core Web Vitals, JSON-LD valide, sitemap à jour) et alerte dès qu'un signal vital régresse.",
        h3s: [
          { title: 'Détection automatique des chutes de trafic', body: "Le Drop Detector utilise une régression ML sur l'historique GSC pour identifier les chutes statistiquement anormales (au-delà de la variance saisonnière). Distingue une chute aléatoire d'une chute structurelle." },
          { title: "Surveillance de l'indexation", body: "Détection des pages indexées qui sortent de l'index, des pages soumises mais non indexées, des changements de statut canonical." },
          { title: 'Alertes Core Web Vitals et bots', body: "Notification dès que LCP/INP/CLS dépasse un seuil, ou qu'un bot stratégique (GPTBot, PerplexityBot, OAI-SearchBot) est bloqué." },
        ],
      },
    ],
    faqs: [
      { q: "À quelle fréquence le monitoring scanne-t-il ?", a: "Indexation et bots : quotidien. Core Web Vitals : hebdomadaire (CrUX). Positions : quotidien. Trafic GSC : hebdomadaire." },
      { q: "Où arrivent les alertes ?", a: "Email, webhook custom (pour Slack ou Teams via Zapier/Make), notifications in-app. Webhook brut sur plan Pro Agency." },
    ],
    datePublished: '2026-04-08',
  },

  'pro-agency': {
    primaryKeyword: 'plateforme SEO agence',
    secondaryKeywords: ['logiciel seo agence', 'outil seo multi-clients', 'plateforme audit seo agence', 'white-label seo', 'gestion seo clients'],
    persona: {
      title: 'Pour qui ?',
      body: "Agences SEO, freelances expérimentés et consultants qui pilotent plusieurs clients et veulent une plateforme unique avec white-label, gestion d'équipe, quotas généreux et tarif prévisible.",
      bullets: [
        'Agences SEO 3-30 collaborateurs',
        'Freelances seniors qui gèrent 5-15 clients récurrents',
        "Consultants qui white-labelent leurs livrables",
        'Studios growth qui ajoutent le SEO à leur offre',
      ],
    },
    sections: [
      {
        h2: "Le plan Pro Agency en détail",
        intro: "Pro Agency réunit tous les modules dans un cadre multi-sites, multi-utilisateurs, multi-rôles : audits illimités, jusqu'à 30 sites, crawl 5000 pages, agents IA, cocon sémantique, content architect, autopilote, white-label, observatoire détaillé.",
        h3s: [
          {
            title: 'Gestion équipe et rôles',
            body: "Trois rôles natifs avec permissions granulaires.",
            h4s: [
              { title: 'Owner', body: "Accès complet, facturation, gestion équipe, suppression de site." },
              { title: 'Editor', body: "Crée et modifie audits, articles, déploiements. Pas d'accès facturation." },
              { title: 'Auditor', body: "Lecture seule, parfait pour un client ou un auditeur externe." },
            ],
          },
          { title: 'White-label des rapports', body: "Vos audits et rapports portent votre logo, vos couleurs et votre URL de partage personnalisée. Aucune mention Crawlers visible pour vos clients (option activable par projet)." },
          { title: 'Quotas et fair use', body: "Audits illimités, 30 sites, crawl 5000 pages par site, 500 mots-clés suivis, content architect illimité, autopilote Breathing Spiral actif. Quotas IA généreux avec garde anti-abus." },
        ],
      },
      {
        h2: "Tarif et engagement",
        h3s: [
          { title: 'Tarif garanti à vie pour les early adopters', body: "29€/mois garanti à vie pour les 100 premiers abonnés Pro Agency. Tarif standard 79-99€/mois ensuite. Engagement mensuel sans frais cachés." },
          { title: 'Migration et accompagnement', body: "Import depuis Screaming Frog (CSV crawl), Search Console, GA4 et Google Ads en quelques clics. Onboarding personnalisé sur Pro Agency." },
        ],
      },
    ],
    faqs: [
      { q: "Combien de sites puis-je gérer sur Pro Agency ?", a: "Jusqu'à 30 sites simultanés. Au-delà, un plan entreprise sur devis est disponible." },
      { q: "Le white-label est-il complet ?", a: "Oui : logo, couleurs, URL de partage personnalisée, suppression des mentions Crawlers sur les rapports clients." },
      { q: "Y a-t-il un essai gratuit ?", a: "Le plan gratuit donne accès à tous les modules de base sur 1 site. Pour tester Pro Agency, contactez-nous pour un mois découverte." },
    ],
    datePublished: '2026-04-08',
  },

  'marina': {
    primaryKeyword: 'prospection B2B SEO',
    secondaryKeywords: ['prospection linkedin', 'outreach b2b automatisé', 'audit prospect agence', 'lead generation seo', 'marina crawlers'],
    persona: {
      title: 'Pour qui ?',
      body: "Agences SEO et freelances qui veulent générer un flux régulier de prospects qualifiés en livrant un audit personnalisé en pré-vente, sans passer leurs soirées à scraper LinkedIn.",
      bullets: [
        'Agences SEO en croissance qui structurent leur prospection',
        'Freelances qui veulent une vitrine professionnelle automatisée',
        'Consultants qui livrent un audit avant le premier call',
        'Studios growth qui industrialisent leur top-of-funnel',
      ],
    },
    sections: [
      {
        h2: "Le module Marina : prospection B2B avec audit en preuve",
        intro: "Marina industrialise le top-of-funnel pour les agences SEO : sélection de prospects qualifiés, audit Crawlers généré automatiquement à leur nom, séquence d'outreach LinkedIn et email, prise de rendez-vous calendar.",
        h3s: [
          { title: 'Sélection des prospects', body: "Filtrez les prospects par secteur, taille, géographie, signaux technologiques (CMS, score SEO actuel, présence GMB). Marina identifie les opportunités à plus fort potentiel d'acquisition." },
          { title: 'Audit en preuve de valeur', body: "Pour chaque prospect, génération automatique d'un audit Crawlers white-label personnalisé. Vous arrivez en réunion avec un livrable déjà chiffré, pas un pitch générique." },
          { title: 'Séquence outreach LinkedIn + email', body: "Pipeline d'outreach multi-canal avec messages personnalisés à partir du diagnostic SEO. Réponses centralisées, lead scoring automatique." },
        ],
      },
    ],
    faqs: [
      { q: "Marina respecte-t-il les ToS de LinkedIn ?", a: "Oui. Les volumes d'envoi quotidiens sont calibrés pour rester dans les limites Sales Navigator/LinkedIn. Aucun scraping massif." },
      { q: "Combien de prospects par mois ?", a: "Variable selon votre plan et votre marché. Comptez 50 à 200 prospects qualifiés par mois en usage standard agence." },
      { q: "Les audits white-label sont-ils inclus ?", a: "Oui, illimités pour les comptes Pro Agency avec module Marina activé." },
    ],
    datePublished: '2026-04-08',
  },
};
