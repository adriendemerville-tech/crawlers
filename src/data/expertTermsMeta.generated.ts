// Fichier généré par scripts/genExpertTermsMeta.ts — ne pas éditer à la main.
// Source de vérité : src/data/expertTerms.ts

export interface ExpertTermMeta {
  term: string;
  description: string;
  definition: string;
}

export const expertTermsMeta: Record<string, Record<string, ExpertTermMeta>> =
{
  "fr": {
    "tls-fingerprinting": {
      "term": "TLS Fingerprinting",
      "description": "Le TLS Fingerprinting est une technique d'identification des clients web basée sur l'analyse de leur négociation TLS (Transport Layer Security). Chaque nav",
      "definition": "Le TLS Fingerprinting est une technique d'identification des clients web basée sur l'analyse de leur négociation TLS (Transport Layer Security). Chaque navigateur, bibliothèque HTTP ou bot génère une empreinte unique lors du handshake SSL, incluant les cipher suites supportées, les extensions TLS et l'ordre des paramètres. Les systèmes anti-bot comme Cloudflare utilisent le hash JA3 pour détecter et bloquer les scrapers automatisés."
    },
    "ja3-ja3s": {
      "term": "JA3 / JA3S",
      "description": "JA3 et JA3S sont des méthodes de fingerprinting réseau développées par Salesforce. JA3 génère un hash MD5 à partir des paramètres du ClientHello TLS (versi",
      "definition": "JA3 et JA3S sont des méthodes de fingerprinting réseau développées par Salesforce. JA3 génère un hash MD5 à partir des paramètres du ClientHello TLS (version SSL, cipher suites, extensions). JA3S fait de même pour le ServerHello. Ces signatures permettent d'identifier précisément le client HTTP utilisé, même si les headers sont falsifiés."
    },
    "behavioral-analysis": {
      "term": "Behavioral Analysis",
      "description": "L'analyse comportementale (Behavioral Analysis) étudie les patterns d'interaction utilisateur pour distinguer les humains des bots. Elle mesure les mouveme",
      "definition": "L'analyse comportementale (Behavioral Analysis) étudie les patterns d'interaction utilisateur pour distinguer les humains des bots. Elle mesure les mouvements de souris, la vitesse de scroll, les délais entre clics, et les séquences de navigation. Des solutions comme DataDome ou PerimeterX utilisent le machine learning pour détecter les comportements non-humains."
    },
    "ip-rotation-proxies": {
      "term": "IP Rotation & Residential Proxies",
      "description": "L'IP Rotation consiste à alterner les adresses IP sources lors du web scraping pour éviter les rate limits et les blocages. Les Residential Proxies utilise",
      "definition": "L'IP Rotation consiste à alterner les adresses IP sources lors du web scraping pour éviter les rate limits et les blocages. Les Residential Proxies utilisent des IP d'utilisateurs résidentiels réels, les rendant indistinguables du trafic légitime. Cette technique est essentielle pour le scraping à grande échelle mais soulève des questions éthiques."
    },
    "canvas-fingerprinting": {
      "term": "Canvas Fingerprinting",
      "description": "Le Canvas Fingerprinting exploite les variations de rendu graphique entre navigateurs et systèmes pour créer une empreinte unique. En demandant au navigate",
      "definition": "Le Canvas Fingerprinting exploite les variations de rendu graphique entre navigateurs et systèmes pour créer une empreinte unique. En demandant au navigateur de dessiner un texte ou une forme, puis en analysant le résultat pixel par pixel, les sites peuvent identifier les visiteurs même sans cookies. Cette technique est utilisée pour le tracking et la détection de bots."
    },
    "user-agent-spoofing": {
      "term": "User-Agent Spoofing",
      "description": "Le User-Agent Spoofing consiste à modifier le header HTTP User-Agent pour faire passer un script ou un bot pour un navigateur légitime. Bien que simple à i",
      "definition": "Le User-Agent Spoofing consiste à modifier le header HTTP User-Agent pour faire passer un script ou un bot pour un navigateur légitime. Bien que simple à implémenter, cette technique seule est insuffisante car les systèmes anti-bot modernes vérifient la cohérence entre le User-Agent déclaré et d'autres signaux (TLS fingerprint, JavaScript APIs)."
    },
    "headless-browsing": {
      "term": "Headless Browsing",
      "description": "Le Headless Browsing permet d'exécuter un navigateur web (Chrome, Firefox) sans affichage graphique, contrôlé par code. Les outils comme Puppeteer (Node.js",
      "definition": "Le Headless Browsing permet d'exécuter un navigateur web (Chrome, Firefox) sans affichage graphique, contrôlé par code. Les outils comme Puppeteer (Node.js), Playwright (multi-langage) et Selenium permettent d'automatiser la navigation, exécuter JavaScript et capturer le contenu rendu. Essentiel pour scraper les SPA modernes."
    },
    "dom-parsing": {
      "term": "DOM Parsing",
      "description": "Le DOM Parsing consiste à analyser le Document Object Model d'une page web pour en extraire des données structurées. Les parsers HTML comme BeautifulSoup (",
      "definition": "Le DOM Parsing consiste à analyser le Document Object Model d'une page web pour en extraire des données structurées. Les parsers HTML comme BeautifulSoup (Python), Cheerio (Node.js) ou lxml transforment le HTML brut en arbre navigable. Cette technique est fondamentale pour le web scraping et l'indexation."
    },
    "shadow-dom": {
      "term": "Shadow DOM",
      "description": "Le Shadow DOM est une API permettant d'encapsuler le markup, le style et le comportement d'un composant web. Ce DOM \"caché\" n'est pas accessible via les sé",
      "definition": "Le Shadow DOM est une API permettant d'encapsuler le markup, le style et le comportement d'un composant web. Ce DOM \"caché\" n'est pas accessible via les sélecteurs CSS ou JavaScript standard, posant un défi pour le web scraping. Les Web Components modernes l'utilisent intensivement."
    },
    "ssr-vs-csr": {
      "term": "SSR vs CSR",
      "description": "SSR (Server-Side Rendering) génère le HTML complet sur le serveur, facilitant l'indexation SEO et le scraping. CSR (Client-Side Rendering) génère le conten",
      "definition": "SSR (Server-Side Rendering) génère le HTML complet sur le serveur, facilitant l'indexation SEO et le scraping. CSR (Client-Side Rendering) génère le contenu via JavaScript dans le navigateur, nécessitant un headless browser pour le scraping. Les frameworks modernes (Next.js, Nuxt) combinent les deux approches."
    },
    "http2-http3": {
      "term": "HTTP/2 & HTTP/3",
      "description": "HTTP/2 introduit le multiplexage (plusieurs requêtes sur une connexion), la compression des headers et le server push. HTTP/3 utilise QUIC au lieu de TCP, ",
      "definition": "HTTP/2 introduit le multiplexage (plusieurs requêtes sur une connexion), la compression des headers et le server push. HTTP/3 utilise QUIC au lieu de TCP, réduisant la latence et améliorant la résilience réseau. Ces protocoles impactent les performances de crawling et la détection des bots."
    },
    "data-normalization": {
      "term": "Data Normalization",
      "description": "La Data Normalization transforme les données brutes extraites en format structuré et cohérent. Elle inclut le nettoyage (suppression de HTML, espaces), la ",
      "definition": "La Data Normalization transforme les données brutes extraites en format structuré et cohérent. Elle inclut le nettoyage (suppression de HTML, espaces), la standardisation (formats de date, devises, unités) et la validation. Étape cruciale entre le scraping et l'exploitation des données par les LLMs."
    },
    "schema-org-extraction": {
      "term": "Schema.org Extraction",
      "description": "L'extraction Schema.org consiste à parser les balises JSON-LD, Microdata ou RDFa intégrées aux pages web. Ces données structurées (produits, articles, évén",
      "definition": "L'extraction Schema.org consiste à parser les balises JSON-LD, Microdata ou RDFa intégrées aux pages web. Ces données structurées (produits, articles, événements, FAQ) sont pré-normalisées par les éditeurs de sites, offrant une source de données de haute qualité pour le scraping et l'alimentation des LLMs."
    },
    "rag": {
      "term": "RAG (Retrieval-Augmented Generation)",
      "description": "Le RAG (Retrieval-Augmented Generation) améliore les réponses des LLMs en leur fournissant des documents pertinents extraits d'une base de connaissances. L",
      "definition": "Le RAG (Retrieval-Augmented Generation) améliore les réponses des LLMs en leur fournissant des documents pertinents extraits d'une base de connaissances. Le processus : la requête utilisateur est vectorisée, les documents similaires sont récupérés, puis injectés dans le prompt du LLM. Le web scraping est essentiel pour alimenter ces bases de connaissances."
    },
    "llm-based-parsing": {
      "term": "LLM-Based Parsing",
      "description": "Le LLM-Based Parsing utilise des modèles de langage pour extraire des données structurées depuis du HTML brut ou du texte. Au lieu de sélecteurs CSS fragil",
      "definition": "Le LLM-Based Parsing utilise des modèles de langage pour extraire des données structurées depuis du HTML brut ou du texte. Au lieu de sélecteurs CSS fragiles, le LLM comprend sémantiquement le contenu et extrait les champs demandés. Cette approche est plus résiliente aux changements de structure des sites."
    },
    "self-healing-scrapers": {
      "term": "Self-Healing Scrapers",
      "description": "Les Self-Healing Scrapers détectent automatiquement quand un site change de structure et s'adaptent sans intervention humaine. Utilisant le machine learnin",
      "definition": "Les Self-Healing Scrapers détectent automatiquement quand un site change de structure et s'adaptent sans intervention humaine. Utilisant le machine learning ou les LLMs, ils identifient les nouveaux sélecteurs correspondant aux mêmes données. Cette approche réduit drastiquement la maintenance des pipelines de scraping."
    },
    "crawl-budget": {
      "term": "Crawl Budget",
      "description": "Le Crawl Budget représente la capacité de crawling allouée par les moteurs de recherche à un site web. Il dépend du \"crawl rate limit\" (vitesse maximale sa",
      "definition": "Le Crawl Budget représente la capacité de crawling allouée par les moteurs de recherche à un site web. Il dépend du \"crawl rate limit\" (vitesse maximale sans surcharger le serveur) et de la \"crawl demand\" (intérêt du contenu). Optimiser son crawl budget est crucial pour l'indexation SEO des grands sites."
    },
    "concurrency-control": {
      "term": "Concurrency Control",
      "description": "Le Concurrency Control régule le nombre de requêtes simultanées envoyées à un serveur lors du scraping. Une concurrence trop élevée peut surcharger le serv",
      "definition": "Le Concurrency Control régule le nombre de requêtes simultanées envoyées à un serveur lors du scraping. Une concurrence trop élevée peut surcharger le serveur cible (DoS involontaire), déclencher des blocages IP, ou violer les conditions d'utilisation. Une gestion intelligente équilibre vitesse et respect du serveur."
    },
    "ethical-scraping": {
      "term": "Ethical Scraping / Responsible Crawling",
      "description": "L'Ethical Scraping désigne les pratiques de collecte de données web respectant les conditions d'utilisation des sites, le robots.txt, les limites de charge",
      "definition": "L'Ethical Scraping désigne les pratiques de collecte de données web respectant les conditions d'utilisation des sites, le robots.txt, les limites de charge serveur, et les réglementations (RGPD). Il implique la transparence (User-Agent identifiable), la proportionnalité (ne collecter que le nécessaire), et le respect de la propriété intellectuelle."
    },
    "robots-txt-interpretation": {
      "term": "Robots.txt Interpretation",
      "description": "L'interprétation du robots.txt consiste à parser et appliquer les directives du fichier /robots.txt qui indique aux robots quelles pages crawler ou éviter.",
      "definition": "L'interprétation du robots.txt consiste à parser et appliquer les directives du fichier /robots.txt qui indique aux robots quelles pages crawler ou éviter. Les directives incluent Allow, Disallow, Crawl-delay, et Sitemap. Les crawlers responsables respectent ces règles, bien qu'elles ne soient pas légalement contraignantes."
    },
    "aeo-answer-engine-optimization": {
      "term": "AEO (Answer Engine Optimization)",
      "description": "Ensemble de techniques visant à structurer et formuler le contenu d'un site web pour qu'il soit sélectionné et lu directement par les assistants vocaux, ou",
      "definition": "Ensemble de techniques visant à structurer et formuler le contenu d'un site web pour qu'il soit sélectionné et lu directement par les assistants vocaux, ou cité comme source de référence par les intelligences artificielles génératives (ChatGPT, Google AI Overviews). Contrairement au SEO traditionnel qui vise le clic, l'AEO vise la citation directe et la Position Zéro."
    },
    "quotability-index": {
      "term": "Quotability Index",
      "description": "Le Quotability Index (indice de citabilité) est un score de 0 à 100 évaluant la capacité d'un contenu web à être repris verbatim par les moteurs de recherc",
      "definition": "Le Quotability Index (indice de citabilité) est un score de 0 à 100 évaluant la capacité d'un contenu web à être repris verbatim par les moteurs de recherche IA (ChatGPT, Perplexity, Gemini). Il analyse la présence de phrases concises, factuelles et auto-suffisantes — des \"snippets naturels\" que les LLM privilégient comme sources de citations directes dans leurs réponses."
    },
    "position-zero": {
      "term": "Position Zéro",
      "description": "La Position Zéro (Featured Snippet) désigne le bloc de réponse directe que Google affiche au-dessus des résultats organiques traditionnels. En 2026, ce con",
      "definition": "La Position Zéro (Featured Snippet) désigne le bloc de réponse directe que Google affiche au-dessus des résultats organiques traditionnels. En 2026, ce concept s'étend aux réponses générées par les AI Overviews de Google et aux citations des moteurs génératifs (Perplexity, ChatGPT Search). Obtenir la position zéro signifie que votre contenu est sélectionné comme LA réponse de référence."
    },
    "query-fan-out": {
      "term": "Query Fan-Out",
      "description": "Le Query Fan-Out est le mécanisme par lequel un moteur de recherche IA (Perplexity, ChatGPT, Google SGE) décompose une requête utilisateur complexe en plus",
      "definition": "Le Query Fan-Out est le mécanisme par lequel un moteur de recherche IA (Perplexity, ChatGPT, Google SGE) décompose une requête utilisateur complexe en plusieurs sous-requêtes thématiques avant de synthétiser une réponse. Comprendre ce phénomène permet d'optimiser son contenu pour couvrir tous les axes sémantiques que l'IA va explorer, maximisant ainsi les chances d'être cité dans la réponse finale."
    },
    "chunkability-score": {
      "term": "Chunkability Score",
      "description": "Le Chunkability Score (score de découpabilité) mesure de 0 à 100 la facilité avec laquelle un contenu web peut être segmenté en \"chunks\" (fragments) exploi",
      "definition": "Le Chunkability Score (score de découpabilité) mesure de 0 à 100 la facilité avec laquelle un contenu web peut être segmenté en \"chunks\" (fragments) exploitables par les moteurs RAG (Retrieval-Augmented Generation). Un score élevé indique une structure claire avec des titres hiérarchiques, des paragraphes distincts et une table des matières — des signaux qui permettent aux IA de découper, indexer et restituer le contenu avec précision."
    },
    "spo-score": {
      "term": "SPO (Score de Priorité d'Optimisation)",
      "description": "Le SPO (Score de Priorité d'Optimisation) est une note composite (0-100) calculée à partir de 8 signaux : CTR Gap, potentiel de conversion, difficulté tech",
      "definition": "Le SPO (Score de Priorité d'Optimisation) est une note composite (0-100) calculée à partir de 8 signaux : CTR Gap, potentiel de conversion, difficulté technique, impact trafic estimé, maturité du cluster, pression concurrentielle, fraîcheur du contenu et gravité technique. Il permet de trier les recommandations d'audit par retour sur investissement."
    },
    "etv-estimated-traffic-value": {
      "term": "ETV (Estimated Traffic Value)",
      "description": "L'ETV (Estimated Traffic Value) est une estimation de la valeur financière du trafic organique d'un site, calculée en multipliant le trafic estimé par mot-",
      "definition": "L'ETV (Estimated Traffic Value) est une estimation de la valeur financière du trafic organique d'un site, calculée en multipliant le trafic estimé par mot-clé par le CPC moyen correspondant en Google Ads. C'est un indicateur proxy du ROI SEO : si un site génère 10 000 visites organiques sur des mots-clés à 2€/clic, son ETV est de 20 000€/mois."
    },
    "voice-dna": {
      "term": "Voice DNA (ADN de Marque)",
      "description": "Le Voice DNA (ADN de Marque) est un profil tonal structuré décrivant le style d'écriture d'un site : ton (professionnel, conversationnel, technique), vocab",
      "definition": "Le Voice DNA (ADN de Marque) est un profil tonal structuré décrivant le style d'écriture d'un site : ton (professionnel, conversationnel, technique), vocabulaire signature, structures de phrases récurrentes, et niveau de formalité. Stocké dans tracked_sites.voice_dna, il est injecté dans les prompts du Content Architect et de Parménion pour garantir la cohérence éditoriale."
    },
    "marina-prospection": {
      "term": "Marina (Module Prospection B2B)",
      "description": "Marina est le module de prospection B2B de Crawlers.fr. Il effectue un audit SEO/GEO externe sur un site prospect (sans accès à ses données internes), génè",
      "definition": "Marina est le module de prospection B2B de Crawlers.fr. Il effectue un audit SEO/GEO externe sur un site prospect (sans accès à ses données internes), génère un rapport de performance avec des recommandations, et alimente un pipeline de prospection LinkedIn. L'architecture est fragmentée en phases (1a/1b/2) avec auto-invocation pour éviter les timeouts."
    },
    "drop-detector": {
      "term": "Drop Detector (Diagnostic de Chute)",
      "description": "Le Drop Detector est un moteur d'analyse de trafic à deux niveaux. Le niveau réactif compare les données GSC/GA4 semaine par semaine et déclenche une alert",
      "definition": "Le Drop Detector est un moteur d'analyse de trafic à deux niveaux. Le niveau réactif compare les données GSC/GA4 semaine par semaine et déclenche une alerte si une baisse > 15% est détectée. Le niveau proactif utilise le Triangle Prédictif pour anticiper les chutes avant qu'elles ne se produisent. Chaque alerte inclut un diagnostic causal (update Google, cannibalisation, perte de backlinks, etc.)."
    },
    "observatoire-sectoriel": {
      "term": "Observatoire (Veille Sectorielle)",
      "description": "L'Observatoire est un module de veille sectorielle autonome qui agrège quotidiennement les signaux du marché : updates Google, tendances de recherche, mouv",
      "definition": "L'Observatoire est un module de veille sectorielle autonome qui agrège quotidiennement les signaux du marché : updates Google, tendances de recherche, mouvements concurrents, nouvelles régulations. Un cron job (aggregate-observatory-daily, 3h00 UTC) collecte les données et génère des alertes personnalisées par secteur."
    },
    "identity-card": {
      "term": "Identity Card (Carte d'Identité Site)",
      "description": "L'Identity Card est le profil de référence d'un site suivi : secteur, modèle d'affaires, cible, zone commerciale, type d'entité, concurrents. Elle est réso",
      "definition": "L'Identity Card est le profil de référence d'un site suivi : secteur, modèle d'affaires, cible, zone commerciale, type d'entité, concurrents. Elle est résolue au début de chaque audit (phase 0) à partir de preuves multi-pages collectées sur le site (contenu, données structurées JSON-LD, mentions légales, gabarits de pages), complétées par la fiche Google Business quand elle existe, puis par les données publiques d'entreprise. Les réseaux sociaux (Meta, LinkedIn) ne sont plus qu'une source secondaire de corroboration, pas la source principale. Le résultat est stocké dans tracked_sites et pilote l'ensemble des audits, prompts GEO et recommandations."
    },
    "fair-use-quotas": {
      "term": "Fair Use (Quotas d'utilisation)",
      "description": "Le système Fair Use définit les quotas de consommation par plan d'abonnement : nombre de crawls, contenus générés, audits IA par période. Pro Agency : 5 00",
      "definition": "Le système Fair Use définit les quotas de consommation par plan d'abonnement : nombre de crawls, contenus générés, audits IA par période. Pro Agency : 5 000 crawls/mois et 80 contenus. Pro Agency+ : 15 000 crawls et 250 contenus. Ces limites protègent la qualité de service et répartissent équitablement les ressources serveur."
    },
    "smart-recommendations": {
      "term": "Smart Recommendations",
      "description": "Smart Recommendations est un système de recommandations contextuelles qui débloque progressivement les fonctionnalités avancées en fonction de la maturité ",
      "definition": "Smart Recommendations est un système de recommandations contextuelles qui débloque progressivement les fonctionnalités avancées en fonction de la maturité SEO du site : un site sans Google Search Console connecté ne se voit pas proposer le Triangle Prédictif. Ce gating évite la surcharge cognitive et guide l'utilisateur vers les actions pertinentes à son stade."
    },
    "ctr-gap": {
      "term": "CTR Gap",
      "description": "Le CTR Gap mesure la différence entre le taux de clic réel d'une page (données GSC) et le CTR moyen attendu pour sa position dans les résultats Google. Un ",
      "definition": "Le CTR Gap mesure la différence entre le taux de clic réel d'une page (données GSC) et le CTR moyen attendu pour sa position dans les résultats Google. Un CTR Gap négatif signifie que la page sous-performe (title/meta description peu attractifs). Un CTR Gap positif indique un snippet optimisé ou une forte notoriété de marque."
    },
    "cro-conversion-rate-optimization": {
      "term": "CRO (Conversion Rate Optimization)",
      "description": "Le CRO (Conversion Rate Optimization) est la discipline d'amélioration systématique du pourcentage de visiteurs qui réalisent une action souhaitée (achat, ",
      "definition": "Le CRO (Conversion Rate Optimization) est la discipline d'amélioration systématique du pourcentage de visiteurs qui réalisent une action souhaitée (achat, inscription, contact). Il combine l'analyse UX, les tests A/B, l'optimisation des CTAs et l'analyse comportementale (heatmaps, scroll depth) pour maximiser la valeur de chaque visite."
    },
    "sea-search-engine-advertising": {
      "term": "SEA (Search Engine Advertising)",
      "description": "Le SEA (Search Engine Advertising) désigne l'achat de liens sponsorisés dans les résultats de recherche. Contrairement au SEO (organique), le SEA offre une",
      "definition": "Le SEA (Search Engine Advertising) désigne l'achat de liens sponsorisés dans les résultats de recherche. Contrairement au SEO (organique), le SEA offre une visibilité immédiate mais payante, facturée au CPC (coût par clic). Le bridge SEA→SEO de Crawlers.fr identifie les keywords rentables en SEA qui méritent un investissement organique."
    },
    "kpi-indicateur-cle": {
      "term": "KPI (Key Performance Indicator)",
      "description": "Un KPI (Key Performance Indicator) est une métrique quantifiable directement liée à un objectif stratégique. En SEO/GEO, les KPIs incluent le trafic organi",
      "definition": "Un KPI (Key Performance Indicator) est une métrique quantifiable directement liée à un objectif stratégique. En SEO/GEO, les KPIs incluent le trafic organique, les positions moyennes, le Score IAS, la Part de Voix, l'ETV et le Quotability Index. La distinction entre KPI (stratégique) et métrique (opérationnelle) est cruciale pour les rapports."
    },
    "roi-retour-investissement": {
      "term": "ROI (Return On Investment)",
      "description": "Le ROI (Return On Investment) mesure le rapport entre les gains générés et les coûts investis. En SEO, le ROI se calcule via l'ETV gagné rapporté au coût d",
      "definition": "Le ROI (Return On Investment) mesure le rapport entre les gains générés et les coûts investis. En SEO, le ROI se calcule via l'ETV gagné rapporté au coût de l'optimisation. Crawlers.fr mesure le ROI de chaque action via les Audit Impact Snapshots (baseline → T+30 → T+60 → T+90)."
    },
    "cta-call-to-action": {
      "term": "CTA (Call To Action)",
      "description": "Un CTA (Call To Action) est un bouton, lien ou texte invitant l'utilisateur à agir : \"Essayer gratuitement\", \"Demander un devis\", \"Lancer l'audit\". Le Conv",
      "definition": "Un CTA (Call To Action) est un bouton, lien ou texte invitant l'utilisateur à agir : \"Essayer gratuitement\", \"Demander un devis\", \"Lancer l'audit\". Le Conversion Optimizer de Crawlers.fr analyse les CTAs sur 4 critères : visibilité, clarté du bénéfice, urgence perçue et positionnement dans le flux de lecture."
    },
    "b2b-business-to-business": {
      "term": "B2B (Business to Business)",
      "description": "Le B2B (Business to Business) désigne les échanges commerciaux entre entreprises. En SEO B2B, les cycles de décision sont longs, les volumes de recherche f",
      "definition": "Le B2B (Business to Business) désigne les échanges commerciaux entre entreprises. En SEO B2B, les cycles de décision sont longs, les volumes de recherche faibles mais à forte valeur, et l'E-E-A-T est critique. Le module Marina de Crawlers.fr est spécifiquement conçu pour la prospection B2B."
    },
    "saas-software-as-a-service": {
      "term": "SaaS (Software as a Service)",
      "description": "Le SaaS (Software as a Service) est un modèle de distribution logicielle où l'application est hébergée dans le cloud et accessible via navigateur. Crawlers",
      "definition": "Le SaaS (Software as a Service) est un modèle de distribution logicielle où l'application est hébergée dans le cloud et accessible via navigateur. Crawlers.fr est un SaaS SEO/GEO avec abonnements Pro Agency (29€/mois) et Pro Agency+ (79€/mois). Les métriques clés SaaS (MRR, churn, ARPU) sont suivies dans le dashboard admin."
    },
    "rgpd-protection-donnees": {
      "term": "RGPD (Règlement Général sur la Protection des Données)",
      "description": "Le RGPD (Règlement Général sur la Protection des Données) est le cadre juridique européen encadrant la collecte, le traitement et le stockage des données p",
      "definition": "Le RGPD (Règlement Général sur la Protection des Données) est le cadre juridique européen encadrant la collecte, le traitement et le stockage des données personnelles. En SEO, il impacte le tracking analytics (consentement cookies), les formulaires de contact, et le stockage des données de crawl. Crawlers.fr applique le RGPD via le chiffrement des tokens OAuth et la suppression automatique des données après archivage."
    }
  },
  "en": {},
  "es": {}
};

export function getExpertTermMeta(
  slug: string,
  language = "fr",
): ExpertTermMeta | undefined {
  return (expertTermsMeta[language] ?? expertTermsMeta.fr)?.[slug];
}
