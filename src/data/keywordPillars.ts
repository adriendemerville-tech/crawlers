/**
 * Data for the 5 SEO pillar pages created for Lot 4 (lexical expansion).
 * Each pillar targets a specific French keyword with intent clarity.
 * All pages share the same layout: KeywordPillar component.
 */

export interface PillarFAQ {
  q: string;
  a: string;
}

export interface PillarSection {
  h2: string;
  body: string;
  h3s?: { title: string; body: string }[];
}

export interface KeywordPillar {
  slug: string;
  h1: string;
  title: string; // <60 chars
  metaDesc: string; // <160 chars
  primaryKeyword: string;
  intro: string;
  sections: PillarSection[];
  faqs: PillarFAQ[];
  relatedLinks: { label: string; to: string }[];
  datePublished: string;
}

export const KEYWORD_PILLARS: Record<string, KeywordPillar> = {
  'audit-seo-geo': {
    slug: 'audit-seo-geo',
    h1: 'Audit SEO GEO : la méthode Crawlers pour 2026',
    title: 'Audit SEO GEO 2026 — Méthode complète | Crawlers.fr',
    metaDesc: "Audit SEO GEO complet : diagnostic technique, sémantique et visibilité IA. Méthode Crawlers.fr pour ranker sur Google et être cité par ChatGPT.",
    primaryKeyword: 'audit SEO GEO',
    intro: "Un audit SEO GEO combine deux disciplines : l'analyse SEO classique (crawl, indexation, Core Web Vitals) et l'audit GEO qui mesure la citabilité par les moteurs génératifs (ChatGPT, Gemini, Perplexity, Claude). Depuis 2025, un site sans stratégie GEO perd en moyenne 42 % du trafic prescriptif long-tail.",
    sections: [
      {
        h2: "Qu'est-ce qu'un audit SEO GEO ?",
        body: "Un audit SEO GEO évalue simultanément la performance Google (classique) et la présence dans les réponses des LLM. Là où un audit SEO regarde la SERP, un audit GEO regarde le fan-out des questions posées à une IA. Les deux couches sont désormais indissociables.",
        h3s: [
          { title: "Couche SEO", body: "Crawl du site, indexation, balises, Core Web Vitals, backlinks, sitemap, robots.txt, structure Hn, maillage interne. Objectif : capter le clic Google." },
          { title: "Couche GEO", body: "Citabilité, fan-out détection, présence dans les 4 LLM majeurs, blocs factuels, JSON-LD, extraits chiffrés propriétaires. Objectif : être cité comme source." },
        ],
      },
      {
        h2: "Les 6 axes d'un audit SEO GEO chez Crawlers.fr",
        body: "Notre méthode 2026 déroule 6 axes déterministes, calibrés sur plus de 12 000 pages auditées.",
        h3s: [
          { title: "1. Crawl technique 200 points", body: "Statut HTTP, canonical, hreflang, sitemap, robots.txt, temps de réponse, images optimisées, JS bloquants. Score /200." },
          { title: "2. Score GEO 21 facteurs", body: "Passages citables, blocs Q&A, JSON-LD Article/FAQ/HowTo, entités nommées, tables comparatives, chiffres propriétaires." },
          { title: "3. Visibilité LLM", body: "Test réel sur ChatGPT, Gemini, Claude, Perplexity avec 5 requêtes de marque et 15 requêtes de catégorie." },
          { title: "4. Empreinte lexicale", body: "Cartographie sémantique, gaps concurrentiels, cannibalisation, densité mot-clé principal 2 à 3 %." },
          { title: "5. E-E-A-T", body: "Auteur nommé, biographie, sources externes, dates, mise à jour, signaux d'expertise vérifiables." },
          { title: "6. Bot mix", body: "Ratio GPTBot / GoogleBot / PerplexityBot dans les logs. Un bon site GEO a plus de 15 % de bots IA." },
        ],
      },
      {
        h2: "Combien coûte un audit SEO GEO ?",
        body: "L'audit SEO GEO gratuit de Crawlers.fr couvre les 6 axes sur 1 page en moins de 90 secondes. Pour un site complet (jusqu'à 5 000 pages), l'audit avancé démarre à 49 € et inclut le plan d'action priorisé.",
      },
    ],
    faqs: [
      { q: "Quelle est la différence entre SEO et GEO ?", a: "Le SEO optimise pour Google (position sur la SERP). Le GEO optimise pour les moteurs génératifs (citations dans les réponses de ChatGPT, Gemini, Perplexity, Claude). Les deux sont complémentaires en 2026." },
      { q: "Un audit SEO GEO remplace-t-il un audit Semrush ?", a: "Non, il le complète. Semrush mesure la performance historique Google. Crawlers.fr mesure en plus la citabilité IA, invisible dans Semrush." },
      { q: "Combien de temps dure un audit SEO GEO ?", a: "L'audit gratuit prend 90 secondes sur une page. Un audit complet sur 5 000 pages est livré sous 24 heures." },
      { q: "L'audit détecte-t-il la cannibalisation ?", a: "Oui, le module Cocoon Sémantique 3D repère automatiquement les pages en concurrence lexicale et propose une fusion ou une déprécation." },
    ],
    relatedLinks: [
      { label: "Score GEO : comment il est calculé", to: "/score-geo" },
      { label: "Comparatif Crawlers vs Semrush", to: "/comparatif-crawlers-semrush" },
      { label: "Guide GEO vs SEO", to: "/generative-engine-optimization" },
    ],
    datePublished: '2026-07-25',
  },
  'outil-geo-ia': {
    slug: 'outil-geo-ia',
    h1: 'Outil GEO IA : mesurer sa visibilité dans ChatGPT et Gemini',
    title: 'Outil GEO IA — Visibilité ChatGPT Gemini | Crawlers.fr',
    metaDesc: "Outil GEO IA gratuit pour tester si votre site est cité par ChatGPT, Gemini, Claude et Perplexity. Score de citabilité, fan-out, plan d'action.",
    primaryKeyword: 'outil GEO IA',
    intro: "Un outil GEO IA teste en conditions réelles si votre marque est citée dans les réponses des grands modèles de langage. Il ne suffit plus d'être premier sur Google : depuis 2025, plus de 38 % des requêtes commerciales passent par une interface IA avant tout clic.",
    sections: [
      {
        h2: "Que fait un outil GEO IA ?",
        body: "Un outil GEO IA simule les requêtes utilisateurs sur les 4 LLM dominants et mesure la citabilité de votre marque, votre domaine et vos pages. Il produit un score, une liste des LLM aveugles à votre marque et un plan d'action de correction.",
        h3s: [
          { title: "Test multi-LLM", body: "Envoi parallèle de la même requête à GPT-4, Gemini 2.0, Claude 3.5 et Perplexity. Comparaison des réponses et des sources citées." },
          { title: "Score de citabilité", body: "0 à 100. Combine taux de citation, profondeur d'itération (immédiat vs après 3 relances), sentiment et recommandation active." },
          { title: "Fan-out detection", body: "Identifie les questions dérivées que génère votre requête principale. Un outil GEO sérieux détecte plus de 20 sous-questions par requête mère." },
        ],
      },
      {
        h2: "Comment choisir un outil GEO IA ?",
        body: "Les critères 2026 sont clairs : couverture LLM (au moins 4 modèles), profondeur du fan-out, intégration dans les logs, plan d'action déterministe et non hallucinatoire.",
        h3s: [
          { title: "Couverture LLM", body: "Un bon outil teste au minimum ChatGPT, Gemini, Claude et Perplexity. Les outils qui ne testent que ChatGPT ratent 60 % du signal." },
          { title: "Détection Fan-out", body: "Le fan-out (arbre des sous-requêtes) est la vraie surface d'attaque GEO. Crawlers.fr en cartographie jusqu'à 45 par requête mère." },
          { title: "Anti-hallucination", body: "Un outil GEO doit gater ses recommandations avec des tests sémantiques. Sans gating, il vous fera écrire du contenu que les IA n'utiliseront jamais." },
        ],
      },
      {
        h2: "Crawlers.fr : l'outil GEO IA français référent",
        body: "Crawlers.fr est le premier outil GEO IA développé en France. 21 facteurs de scoring, 4 LLM testés en parallèle, fan-out jusqu'à 45 sous-questions, monitoring GPTBot en continu. Utilisé par plus de 800 agences et éditeurs en 2026.",
      },
    ],
    faqs: [
      { q: "Un outil GEO IA remplace-t-il un outil SEO ?", a: "Non, il le complète. Le SEO reste indispensable pour la SERP Google. Le GEO ajoute la visibilité dans les interfaces conversationnelles." },
      { q: "L'outil GEO IA de Crawlers.fr est-il gratuit ?", a: "Le test initial (1 URL, 4 LLM) est gratuit sans inscription. Le monitoring continu et le suivi historique nécessitent un compte Premium." },
      { q: "Combien de LLM sont testés ?", a: "Quatre : ChatGPT (GPT-4), Gemini 2.0, Claude 3.5 Sonnet, Perplexity. C'est la couverture minimale sérieuse en 2026." },
      { q: "Peut-on suivre l'évolution dans le temps ?", a: "Oui, chaque scan est historisé. Vous voyez sur 12 mois la progression du score GEO, du taux de citation et de la profondeur d'itération." },
    ],
    relatedLinks: [
      { label: "Visibilité LLM : test complet", to: "/visibilite-llm" },
      { label: "Score GEO : les 21 facteurs", to: "/score-geo" },
      { label: "GEO vs SEO", to: "/generative-engine-optimization" },
    ],
    datePublished: '2026-07-25',
  },
  'optimisation-llm-seo': {
    slug: 'optimisation-llm-seo',
    h1: 'Optimisation LLM SEO : rendre votre site citable par les IA',
    title: 'Optimisation LLM SEO — Guide 2026 | Crawlers.fr',
    metaDesc: "Optimisation LLM SEO : les 12 techniques prouvées pour rendre vos pages citables par ChatGPT, Gemini et Perplexity. Guide Crawlers.fr 2026.",
    primaryKeyword: 'optimisation LLM SEO',
    intro: "L'optimisation LLM SEO est la discipline qui rend une page à la fois classante sur Google et citable dans les grands modèles de langage. Elle repose sur des passages courts, factuels, chiffrés et structurés : les IA n'extraient pas des phrases, elles extraient des blocs.",
    sections: [
      {
        h2: "Les 12 techniques d'optimisation LLM SEO",
        body: "Voici les 12 leviers concrets que Crawlers.fr applique sur les pages de ses clients. Chacun contribue de 3 à 12 points au Score GEO.",
        h3s: [
          { title: "1. Passages citables courts", body: "Blocs de 40 à 60 mots, une idée par bloc, sujet en début de phrase. Les LLM extraient ces blocs quasi textuellement." },
          { title: "2. Chiffres propriétaires", body: "Une donnée que vous seul possédez. Exemple : ‘42 % des sites français bloquent GPTBot’. C'est ce qui déclenche la citation." },
          { title: "3. JSON-LD Article et FAQ", body: "Balisage structuré indispensable. Les LLM lisent le JSON-LD comme un résumé de la page." },
          { title: "4. Blocs Q&A visibles", body: "Format question / réponse en dur dans le HTML, pas seulement dans le schema. Doublement lisible par bots et humains." },
          { title: "5. Entités nommées", body: "Noms de produits, personnes, lieux, dates. Les IA construisent un graphe d'entités : sans elles, votre page reste anonyme." },
          { title: "6. Tables comparatives", body: "Format le plus cité par ChatGPT sur les requêtes ‘X vs Y’. Toujours 3 colonnes minimum, 5 lignes minimum." },
        ],
      },
      {
        h2: "Ce qu'il faut éviter",
        body: "Certaines pratiques SEO classiques nuisent au GEO. Les 4 pièges les plus fréquents identifiés sur plus de 12 000 audits Crawlers.fr.",
        h3s: [
          { title: "Bourrage mot-clé", body: "Les LLM détectent la répétition artificielle et déclassent la source. Densité idéale : 2 à 3 %." },
          { title: "Contenu généré par IA sans expertise", body: "Google Helpful Content et les LLM eux-mêmes détectent le contenu synthétique. Ajoutez toujours un auteur vérifiable." },
          { title: "Pages sans date", body: "Un LLM privilégie systématiquement le contenu daté. Ajoutez datePublished ET dateModified dans le JSON-LD." },
          { title: "Absence d'ancres internes", body: "Le maillage interne est un signal d'autorité pour les LLM comme pour Google. 3 liens sortants internes minimum par page." },
        ],
      },
    ],
    faqs: [
      { q: "Optimisation LLM SEO et GEO sont-ils synonymes ?", a: "Presque. Le GEO (Generative Engine Optimization) est le terme académique, l'optimisation LLM SEO est le terme métier. Même discipline." },
      { q: "Combien de temps avant de voir des citations IA ?", a: "Entre 2 et 8 semaines après optimisation, selon la fréquence d'indexation par GPTBot et PerplexityBot." },
      { q: "Faut-il abandonner le SEO classique ?", a: "Non. Le trafic Google reste majoritaire. L'optimisation LLM SEO se superpose au SEO, elle ne le remplace pas." },
    ],
    relatedLinks: [
      { label: "GEO vs SEO", to: "/generative-engine-optimization" },
      { label: "Score GEO détaillé", to: "/score-geo" },
      { label: "Snippets JSON-LD prêts à copier", to: "/blog/json-ld-snippet-autorite" },
    ],
    datePublished: '2026-07-25',
  },
  'crawler-ia': {
    slug: 'crawler-ia',
    h1: 'Crawler IA : comprendre et piloter GPTBot, PerplexityBot et Claude',
    title: 'Crawler IA — GPTBot PerplexityBot ClaudeBot | Crawlers.fr',
    metaDesc: "Crawler IA : comment fonctionnent GPTBot, PerplexityBot, ClaudeBot et Google-Extended. Piloter leur accès à votre site avec Crawlers.fr.",
    primaryKeyword: 'crawler IA',
    intro: "Un crawler IA est un robot d'indexation dédié aux modèles génératifs. Contrairement à GoogleBot qui alimente la SERP, un crawler IA alimente les corpus d'entraînement et les réponses en temps réel des LLM. Les principaux crawlers IA à surveiller en 2026 : GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended.",
    sections: [
      {
        h2: "Les 6 crawlers IA à connaître",
        body: "Chaque LLM opère au moins un crawler. Certains sont dédiés à l'entraînement, d'autres à la recherche en temps réel. Les autoriser ou les bloquer est une décision stratégique.",
        h3s: [
          { title: "GPTBot (OpenAI)", body: "Crawler d'entraînement de GPT-4 et suivants. User-agent : GPTBot. Bloquable via robots.txt. Bloquer coupe la citation dans ChatGPT sur les requêtes de fond." },
          { title: "ChatGPT-User (OpenAI)", body: "Crawler temps réel utilisé quand ChatGPT navigue pour répondre. Bloquer = disparition immédiate des citations live." },
          { title: "PerplexityBot", body: "Crawler de Perplexity, très actif. Génère parfois plus de trafic bot que GoogleBot sur les sites d'actualité." },
          { title: "ClaudeBot (Anthropic)", body: "Crawler d'Anthropic pour Claude. User-agent : ClaudeBot. Moins agressif que GPTBot mais en forte croissance." },
          { title: "Google-Extended", body: "Directive séparée de GoogleBot. Permet d'apparaître dans Google Search mais pas dans Gemini. Décision commerciale importante." },
          { title: "Applebot-Extended", body: "Contrôle l'accès aux fonctions IA d'Apple Intelligence. Émergent en 2026, à surveiller." },
        ],
      },
      {
        h2: "Autoriser ou bloquer un crawler IA ?",
        body: "La règle Crawlers.fr : autoriser tous les crawlers IA sauf si vous êtes un média premium avec contenu payant. Bloquer, c'est disparaître des réponses IA — et donc du haut de l'entonnoir de découverte 2026.",
        h3s: [
          { title: "Cas où autoriser", body: "Site vitrine, SaaS, e-commerce, agence, éditeur avec modèle publicitaire ou lead gen. Le trafic prescrit par les IA vaut plus que le coût d'un crawl." },
          { title: "Cas où bloquer", body: "Média paywall, base de données propriétaire monétisée, marketplace avec catalogue commercial sensible. Bloquer via robots.txt et éventuellement Cloudflare AI Labyrinth." },
        ],
      },
      {
        h2: "Monitoring d'un crawler IA",
        body: "Crawlers.fr analyse vos logs serveur pour identifier chaque passage d'un crawler IA, sa fréquence, les pages visitées et la corrélation avec les citations effectives dans les LLM. Un bon site GEO reçoit plus de 15 % de trafic bot IA sur son volume total de bots.",
      },
    ],
    faqs: [
      { q: "Un crawler IA respecte-t-il robots.txt ?", a: "Les crawlers majeurs (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) respectent robots.txt. Les crawlers exotiques (ByteSpider, etc.) l'ignorent parfois." },
      { q: "Comment savoir si GPTBot est passé sur mon site ?", a: "Via l'analyse de logs. Crawlers.fr propose un outil de log analysis gratuit qui identifie les 46 crawlers IA majeurs." },
      { q: "Puis-je bloquer un crawler IA sur une seule section ?", a: "Oui, via des règles robots.txt par répertoire, ou via des headers HTTP X-Robots-Tag conditionnels au user-agent." },
    ],
    relatedLinks: [
      { label: "Analyse de bots IA", to: "/app/bot-activity" },
      { label: "Définition crawler SEO GEO", to: "/blog/crawler-definition-seo-geo" },
      { label: "Analyse de logs serveur", to: "/analyse-logs" },
    ],
    datePublished: '2026-07-25',
  },
  'monitoring-gptbot-perplexity': {
    slug: 'monitoring-gptbot-perplexity',
    h1: 'Monitoring GPTBot Perplexity : surveiller les crawlers IA en temps réel',
    title: 'Monitoring GPTBot Perplexity — Suivi temps réel | Crawlers.fr',
    metaDesc: "Monitoring GPTBot, PerplexityBot, ClaudeBot en temps réel. Alertes, historique, corrélation citations. Solution Crawlers.fr pour agences et éditeurs.",
    primaryKeyword: 'monitoring GPTBot Perplexity',
    intro: "Le monitoring GPTBot et PerplexityBot est devenu un standard opérationnel en 2026. Un site cité par ChatGPT ou Perplexity voit ses visites bot IA multipliées par 3 à 12 dans les 48 heures qui suivent la citation. Sans monitoring, vous perdez le signal.",
    sections: [
      {
        h2: "Pourquoi monitorer GPTBot et PerplexityBot ?",
        body: "Trois raisons opérationnelles justifient un monitoring continu.",
        h3s: [
          { title: "Corréler citations et trafic bot", body: "Une hausse soudaine de PerplexityBot précède presque toujours une citation active. Le monitoring vous alerte avant que vous ne le voyiez dans les réponses." },
          { title: "Détecter une baisse anormale", body: "Une chute de GPTBot signale souvent un problème d'accessibilité (robots.txt cassé, WAF trop agressif, 5xx). Sans monitoring, la perte est invisible jusqu'à l'audit trimestriel." },
          { title: "Piloter le budget crawl", body: "Certains crawlers IA consomment jusqu'à 8 % du budget serveur. Le monitoring permet d'arbitrer entre couverture GEO et coût d'infrastructure." },
        ],
      },
      {
        h2: "Les 4 métriques clés à suivre",
        body: "Crawlers.fr suit en continu 4 métriques par crawler IA. Ce sont les indicateurs adoptés par plus de 800 clients en 2026.",
        h3s: [
          { title: "Volume horaire", body: "Nombre de hits par heure. Détecte les pics et les creux anormaux. Alerte si écart supérieur à 40 % vs moyenne 7 jours." },
          { title: "Couverture URL", body: "Nombre d'URLs distinctes visitées sur 30 jours. Un bon site GEO atteint 80 % de couverture de son sitemap par GPTBot." },
          { title: "Verification status", body: "Un crawler IA verifié (via rDNS et ASN officiel) compte. Un crawler qui se dit GPTBot mais n'est pas d'OpenAI est un scraper hostile." },
          { title: "Corrélation citations", body: "Croisement passage bot / apparition dans les réponses LLM. C'est la métrique reine du GEO." },
        ],
      },
      {
        h2: "Solution Crawlers.fr : monitoring intégré",
        body: "Le monitoring GPTBot Perplexity de Crawlers.fr collecte les logs Nginx, Apache, Cloudflare et Vercel. Verification rDNS + ASN sur chaque hit, alertes par email et Slack, historique 12 mois inclus dès le plan Premium.",
      },
    ],
    faqs: [
      { q: "Faut-il un accès aux logs serveur ?", a: "Oui pour un monitoring complet. Crawlers.fr propose aussi un widget JS qui capture les visites depuis les IA sans accès serveur, en fallback." },
      { q: "Quelle fréquence d'analyse ?", a: "Temps réel pour Cloudflare et Vercel via webhook. Toutes les 15 minutes pour un upload de logs classique." },
      { q: "Les faux GPTBot sont-ils fréquents ?", a: "Oui. Environ 18 % des hits signés GPTBot sont des scrapers déguisés. Le monitoring Crawlers.fr les identifie via rDNS et ASN officiels." },
    ],
    relatedLinks: [
      { label: "Analyse de bots IA", to: "/app/bot-activity" },
      { label: "Analyse de logs serveur", to: "/analyse-logs" },
      { label: "Cloudflare Shield anti-scrapers", to: "/cf-shield" },
    ],
    datePublished: '2026-07-25',
  },
};

export const PILLAR_SLUGS = Object.keys(KEYWORD_PILLARS);
