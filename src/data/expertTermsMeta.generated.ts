// Fichier généré par scripts/genExpertTermsMeta.ts — ne pas éditer à la main.
// Source de vérité : src/data/expertTerms.ts

export interface ExpertTermMeta {
  term: string;
  description: string;
}

export const expertTermsMeta: Record<string, Record<string, ExpertTermMeta>> =
{
  "fr": {
    "tls-fingerprinting": {
      "term": "TLS Fingerprinting",
      "description": "Le TLS Fingerprinting est une technique d'identification des clients web basée sur l'analyse de leur négociation TLS (Transport Layer Security). Chaque nav"
    },
    "ja3-ja3s": {
      "term": "JA3 / JA3S",
      "description": "JA3 et JA3S sont des méthodes de fingerprinting réseau développées par Salesforce. JA3 génère un hash MD5 à partir des paramètres du ClientHello TLS (versi"
    },
    "behavioral-analysis": {
      "term": "Behavioral Analysis",
      "description": "L'analyse comportementale (Behavioral Analysis) étudie les patterns d'interaction utilisateur pour distinguer les humains des bots. Elle mesure les mouveme"
    },
    "ip-rotation-proxies": {
      "term": "IP Rotation & Residential Proxies",
      "description": "L'IP Rotation consiste à alterner les adresses IP sources lors du web scraping pour éviter les rate limits et les blocages. Les Residential Proxies utilise"
    },
    "canvas-fingerprinting": {
      "term": "Canvas Fingerprinting",
      "description": "Le Canvas Fingerprinting exploite les variations de rendu graphique entre navigateurs et systèmes pour créer une empreinte unique. En demandant au navigate"
    },
    "user-agent-spoofing": {
      "term": "User-Agent Spoofing",
      "description": "Le User-Agent Spoofing consiste à modifier le header HTTP User-Agent pour faire passer un script ou un bot pour un navigateur légitime. Bien que simple à i"
    },
    "headless-browsing": {
      "term": "Headless Browsing",
      "description": "Le Headless Browsing permet d'exécuter un navigateur web (Chrome, Firefox) sans affichage graphique, contrôlé par code. Les outils comme Puppeteer (Node.js"
    },
    "dom-parsing": {
      "term": "DOM Parsing",
      "description": "Le DOM Parsing consiste à analyser le Document Object Model d'une page web pour en extraire des données structurées. Les parsers HTML comme BeautifulSoup ("
    },
    "shadow-dom": {
      "term": "Shadow DOM",
      "description": "Le Shadow DOM est une API permettant d'encapsuler le markup, le style et le comportement d'un composant web. Ce DOM \"caché\" n'est pas accessible via les sé"
    },
    "ssr-vs-csr": {
      "term": "SSR vs CSR",
      "description": "SSR (Server-Side Rendering) génère le HTML complet sur le serveur, facilitant l'indexation SEO et le scraping. CSR (Client-Side Rendering) génère le conten"
    },
    "http2-http3": {
      "term": "HTTP/2 & HTTP/3",
      "description": "HTTP/2 introduit le multiplexage (plusieurs requêtes sur une connexion), la compression des headers et le server push. HTTP/3 utilise QUIC au lieu de TCP, "
    },
    "data-normalization": {
      "term": "Data Normalization",
      "description": "La Data Normalization transforme les données brutes extraites en format structuré et cohérent. Elle inclut le nettoyage (suppression de HTML, espaces), la "
    },
    "schema-org-extraction": {
      "term": "Schema.org Extraction",
      "description": "L'extraction Schema.org consiste à parser les balises JSON-LD, Microdata ou RDFa intégrées aux pages web. Ces données structurées (produits, articles, évén"
    },
    "rag": {
      "term": "RAG (Retrieval-Augmented Generation)",
      "description": "Le RAG (Retrieval-Augmented Generation) améliore les réponses des LLMs en leur fournissant des documents pertinents extraits d'une base de connaissances. L"
    },
    "llm-based-parsing": {
      "term": "LLM-Based Parsing",
      "description": "Le LLM-Based Parsing utilise des modèles de langage pour extraire des données structurées depuis du HTML brut ou du texte. Au lieu de sélecteurs CSS fragil"
    },
    "self-healing-scrapers": {
      "term": "Self-Healing Scrapers",
      "description": "Les Self-Healing Scrapers détectent automatiquement quand un site change de structure et s'adaptent sans intervention humaine. Utilisant le machine learnin"
    },
    "crawl-budget": {
      "term": "Crawl Budget",
      "description": "Le Crawl Budget représente la capacité de crawling allouée par les moteurs de recherche à un site web. Il dépend du \"crawl rate limit\" (vitesse maximale sa"
    },
    "concurrency-control": {
      "term": "Concurrency Control",
      "description": "Le Concurrency Control régule le nombre de requêtes simultanées envoyées à un serveur lors du scraping. Une concurrence trop élevée peut surcharger le serv"
    },
    "ethical-scraping": {
      "term": "Ethical Scraping / Responsible Crawling",
      "description": "L'Ethical Scraping désigne les pratiques de collecte de données web respectant les conditions d'utilisation des sites, le robots.txt, les limites de charge"
    },
    "robots-txt-interpretation": {
      "term": "Robots.txt Interpretation",
      "description": "L'interprétation du robots.txt consiste à parser et appliquer les directives du fichier /robots.txt qui indique aux robots quelles pages crawler ou éviter."
    },
    "aeo-answer-engine-optimization": {
      "term": "AEO (Answer Engine Optimization)",
      "description": "Ensemble de techniques visant à structurer et formuler le contenu d'un site web pour qu'il soit sélectionné et lu directement par les assistants vocaux, ou"
    },
    "quotability-index": {
      "term": "Quotability Index",
      "description": "Le Quotability Index (indice de citabilité) est un score de 0 à 100 évaluant la capacité d'un contenu web à être repris verbatim par les moteurs de recherc"
    },
    "position-zero": {
      "term": "Position Zéro",
      "description": "La Position Zéro (Featured Snippet) désigne le bloc de réponse directe que Google affiche au-dessus des résultats organiques traditionnels. En 2026, ce con"
    },
    "query-fan-out": {
      "term": "Query Fan-Out",
      "description": "Le Query Fan-Out est le mécanisme par lequel un moteur de recherche IA (Perplexity, ChatGPT, Google SGE) décompose une requête utilisateur complexe en plus"
    },
    "chunkability-score": {
      "term": "Chunkability Score",
      "description": "Le Chunkability Score (score de découpabilité) mesure de 0 à 100 la facilité avec laquelle un contenu web peut être segmenté en \"chunks\" (fragments) exploi"
    },
    "spo-score": {
      "term": "SPO (Score de Priorité d'Optimisation)",
      "description": "Le SPO (Score de Priorité d'Optimisation) est une note composite (0-100) calculée à partir de 8 signaux : CTR Gap, potentiel de conversion, difficulté tech"
    },
    "etv-estimated-traffic-value": {
      "term": "ETV (Estimated Traffic Value)",
      "description": "L'ETV (Estimated Traffic Value) est une estimation de la valeur financière du trafic organique d'un site, calculée en multipliant le trafic estimé par mot-"
    },
    "voice-dna": {
      "term": "Voice DNA (ADN de Marque)",
      "description": "Le Voice DNA (ADN de Marque) est un profil tonal structuré décrivant le style d'écriture d'un site : ton (professionnel, conversationnel, technique), vocab"
    },
    "marina-prospection": {
      "term": "Marina (Module Prospection B2B)",
      "description": "Marina est le module de prospection B2B de Crawlers.fr. Il effectue un audit SEO/GEO externe sur un site prospect (sans accès à ses données internes), génè"
    },
    "drop-detector": {
      "term": "Drop Detector (Diagnostic de Chute)",
      "description": "Le Drop Detector est un moteur d'analyse de trafic à deux niveaux. Le niveau réactif compare les données GSC/GA4 semaine par semaine et déclenche une alert"
    },
    "observatoire-sectoriel": {
      "term": "Observatoire (Veille Sectorielle)",
      "description": "L'Observatoire est un module de veille sectorielle autonome qui agrège quotidiennement les signaux du marché : updates Google, tendances de recherche, mouv"
    },
    "identity-card": {
      "term": "Identity Card (Carte d'Identité Site)",
      "description": "L'Identity Card est le profil de référence d'un site suivi : secteur, modèle d'affaires, cible, zone commerciale, type d'entité, concurrents. Elle est réso"
    },
    "fair-use-quotas": {
      "term": "Fair Use (Quotas d'utilisation)",
      "description": "Le système Fair Use définit les quotas de consommation par plan d'abonnement : nombre de crawls, contenus générés, audits IA par période. Pro Agency : 5 00"
    },
    "smart-recommendations": {
      "term": "Smart Recommendations",
      "description": "Smart Recommendations est un système de recommandations contextuelles qui débloque progressivement les fonctionnalités avancées en fonction de la maturité "
    },
    "ctr-gap": {
      "term": "CTR Gap",
      "description": "Le CTR Gap mesure la différence entre le taux de clic réel d'une page (données GSC) et le CTR moyen attendu pour sa position dans les résultats Google. Un "
    },
    "cro-conversion-rate-optimization": {
      "term": "CRO (Conversion Rate Optimization)",
      "description": "Le CRO (Conversion Rate Optimization) est la discipline d'amélioration systématique du pourcentage de visiteurs qui réalisent une action souhaitée (achat, "
    },
    "sea-search-engine-advertising": {
      "term": "SEA (Search Engine Advertising)",
      "description": "Le SEA (Search Engine Advertising) désigne l'achat de liens sponsorisés dans les résultats de recherche. Contrairement au SEO (organique), le SEA offre une"
    },
    "kpi-indicateur-cle": {
      "term": "KPI (Key Performance Indicator)",
      "description": "Un KPI (Key Performance Indicator) est une métrique quantifiable directement liée à un objectif stratégique. En SEO/GEO, les KPIs incluent le trafic organi"
    },
    "roi-retour-investissement": {
      "term": "ROI (Return On Investment)",
      "description": "Le ROI (Return On Investment) mesure le rapport entre les gains générés et les coûts investis. En SEO, le ROI se calcule via l'ETV gagné rapporté au coût d"
    },
    "cta-call-to-action": {
      "term": "CTA (Call To Action)",
      "description": "Un CTA (Call To Action) est un bouton, lien ou texte invitant l'utilisateur à agir : \"Essayer gratuitement\", \"Demander un devis\", \"Lancer l'audit\". Le Conv"
    },
    "b2b-business-to-business": {
      "term": "B2B (Business to Business)",
      "description": "Le B2B (Business to Business) désigne les échanges commerciaux entre entreprises. En SEO B2B, les cycles de décision sont longs, les volumes de recherche f"
    },
    "saas-software-as-a-service": {
      "term": "SaaS (Software as a Service)",
      "description": "Le SaaS (Software as a Service) est un modèle de distribution logicielle où l'application est hébergée dans le cloud et accessible via navigateur. Crawlers"
    },
    "rgpd-protection-donnees": {
      "term": "RGPD (Règlement Général sur la Protection des Données)",
      "description": "Le RGPD (Règlement Général sur la Protection des Données) est le cadre juridique européen encadrant la collecte, le traitement et le stockage des données p"
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
