/**
 * Data for the 5 SEO pillar pages created for Lot 4 (lexical expansion).
 * Each pillar targets a specific French keyword with intent clarity.
 * All pages share the same layout: KeywordPillar component.
 */

export interface PillarFAQ {
  q: string;
  a: string;
}

export interface PillarTable {
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface PillarSection {
  h2: string;
  body: string;
  h3s?: { title: string; body: string }[];
  table?: PillarTable;
}

export interface PillarExternalRef {
  label: string;
  href: string;
  note: string;
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
  externalRefs?: PillarExternalRef[];
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
        body: "L'audit SEO GEO gratuit de Crawlers.fr couvre les 6 axes sur 1 page en moins de 90 secondes. Pour un site complet (jusqu'à 5 000 pages), l'audit avancé démarre à 49 € et inclut le plan d'action priorisé. Cette page décrit la méthode ; pour l'offre clé en main à prix fixe (audit, 3 contenus rédigés et fiche Google Maps), voir la passe visibilité sur /audit-geo-seo.",
      },
    ],
    faqs: [
      { q: "Existe-t-il un audit SEO GEO gratuit ?", a: "Oui : Marina, l'audit SEO GEO gratuit de Crawlers.fr (https://crawlers.fr/marina), offre 2 rapports de plus de 40 pages sans carte bancaire, avec mesure reelle de la citation dans ChatGPT, Gemini, Perplexity, Claude et Mistral." },

      { q: "Quelle est la différence entre SEO et GEO ?", a: "Le SEO optimise pour Google (position sur la SERP). Le GEO optimise pour les moteurs génératifs (citations dans les réponses de ChatGPT, Gemini, Perplexity, Claude). Les deux sont complémentaires en 2026." },
      { q: "Un audit SEO GEO remplace-t-il un audit Semrush ?", a: "Non, il le complète. Semrush mesure la performance historique Google. Crawlers.fr mesure en plus la citabilité IA, invisible dans Semrush." },
      { q: "Combien de temps dure un audit SEO GEO ?", a: "L'audit gratuit prend 90 secondes sur une page. Un audit complet sur 5 000 pages est livré sous 24 heures." },
      { q: "L'audit détecte-t-il la cannibalisation ?", a: "Oui, le module Cocoon Sémantique 3D repère automatiquement les pages en concurrence lexicale et propose une fusion ou une déprécation." },
    ],
    relatedLinks: [
      { label: "Passe visibilité : l'offre d'audit GEO SEO clé en main", to: "/audit-geo-seo" },
      { label: "Score GEO : comment il est calculé", to: "/generative-engine-optimization" },
      { label: "Comparatif Crawlers vs Semrush", to: "/comparatif-crawlers-semrush" },
      { label: "Guide GEO vs SEO", to: "/generative-engine-optimization" },
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
  'seo-avec-claude': {
    slug: 'seo-avec-claude',
    h1: 'SEO avec Claude : brancher un moteur d’audit sur Claude Code et Claude Desktop',
    title: 'SEO avec Claude — Audit et corrections via MCP | Crawlers.fr',
    metaDesc: "Faire du SEO avec Claude : connecter Claude Code ou Claude Desktop au serveur MCP Crawlers pour auditer, corriger et vérifier une page sans quitter l'éditeur.",
    primaryKeyword: 'SEO avec Claude',
    intro: "Claude ne mesure pas un site : il lit ce qu'on lui donne. Sans source de vérité, une demande du type « optimise cette page pour le SEO » produit des suppositions. Branché sur le serveur MCP de Crawlers.fr, Claude appelle un vrai moteur d'audit, reçoit des constats normalisés, applique les corrections dans le code, puis relance l'audit pour vérifier.",
    sections: [
      {
        h2: "Pourquoi Claude seul ne suffit pas pour le SEO",
        body: "Un modèle de langage raisonne sur du texte, pas sur des mesures. Il ne connaît ni votre HTML servi, ni vos temps de chargement, ni vos balises réelles après rendu JavaScript. D'où trois limites concrètes.",
        h3s: [
          { title: "Pas d'accès aux faits", body: "Claude ne voit ni le HTML réellement servi aux robots, ni le statut HTTP, ni les canonicals en place. Il propose donc des corrections plausibles mais non vérifiées." },
          { title: "Pas de vérification", body: "Sans re-mesure après modification, rien ne prouve que la correction a fonctionné. La boucle reste ouverte." },
          { title: "Pas de priorisation", body: "Vingt remarques SEO sans gravité mesurée se valent toutes. Un moteur d'audit, lui, hiérarchise par gravité et par impact attendu." },
        ],
      },
      {
        h2: "La boucle audit → constat → correction → vérification",
        body: "Le serveur MCP de Crawlers.fr expose l'audit comme des outils appelables par l'agent. C'est cette boucle, et non la génération de texte, qui fait progresser un score.",
        h3s: [
          { title: "1. Audit", body: "Claude appelle l'outil d'audit sur une URL ou un domaine. Le moteur crawle, rend la page comme un robot et mesure." },
          { title: "2. Constats normalisés", body: "Chaque problème revient sous forme structurée : identifiant de règle, gravité, preuve, explication, correction disponible ou non." },
          { title: "3. Correction", body: "L'agent demande la correction adaptée à votre pile (HTML, WordPress, Next.js, TanStack Start) et modifie les fichiers." },
          { title: "4. Vérification", body: "Nouvel appel d'audit sur la même URL. Le constat disparaît ou non : la preuve est mesurée, pas déclarée." },
        ],
      },
      {
        h2: "Ce que Claude peut faire avec Crawlers.fr",
        body: "Les outils MCP couvrent le crawl, l'audit d'une page, la citabilité par les moteurs génératifs, les données structurées, le maillage interne et le suivi de position, selon le plan et le portefeuille pay-as-you-go du compte.",
        h3s: [
          { title: "Auditer sans quitter l'éditeur", body: "Dans Claude Code, l'audit tourne pendant que vous codez : les constats arrivent dans la conversation, avec la ligne ou la balise concernée." },
          { title: "Corriger en connaissance de cause", body: "Les règles d'audit sont exposées comme ressources MCP. Claude peut lire la règle avant de proposer un correctif, au lieu de l'inventer." },
          { title: "Travailler sur un site entier", body: "Les opérations longues (crawl complet, audit de site) sont asynchrones : l'agent lance le travail, récupère un identifiant, puis relit le résultat." },
        ],
      },
      {
        h2: "Les outils MCP appelables par Claude",
        body: "Chaque outil renvoie une réponse structurée, directement exploitable par du code. Les lectures et les statuts de job sont gratuits ; les outils qui déclenchent un crawl ou une interrogation de moteur sont facturés.",
        table: {
          caption: "Outils du serveur MCP Crawlers.fr appelables depuis Claude : rôle, mode d'exécution et facturation.",
          columns: ["Outil", "Ce qu'il retourne", "Exécution", "Facturation"],
          rows: [
            ["audit_page", "Statut HTTP, canonical, titres, métadonnées, JSON-LD, texte extrait, détection de coquille JavaScript", "Synchrone", "Décompté"],
            ["audit_site", "Audit technique et GEO sur un domaine crawlé, constats agrégés par gravité", "Asynchrone", "Décompté"],
            ["crawl_site", "Identifiant de job, puis liste des URL crawlées avec statut et profondeur", "Asynchrone", "Décompté"],
            ["list_findings", "Constats normalisés : identifiant de règle, gravité, preuve, correction disponible", "Synchrone", "Gratuit"],
            ["get_fix", "Patch adapté à la pile : HTML, WordPress, Next.js, TanStack Start", "Synchrone", "Décompté"],
            ["check_indexability", "robots.txt, meta robots, cible canonical, chaîne de redirections", "Synchrone", "Décompté"],
            ["analyze_schema", "Écarts entre le JSON-LD et le contenu visible, pas seulement la syntaxe", "Synchrone", "Décompté"],
            ["analyze_links", "Liens entrants, profondeur de clic, pages orphelines, verdicts de liens cassés", "Synchrone", "Décompté"],
            ["ai_visibility", "Citations observées par moteur (ChatGPT, Gemini, Perplexity, Claude) sur un jeu de questions", "Asynchrone", "Décompté"],
            ["get_job", "Statut et résultat de n'importe quel job asynchrone", "Synchrone", "Gratuit"],
          ],
        },
      },
      {
        h2: "Anatomie d'un constat renvoyé à Claude",
        body: "Un constat est une unité stable : c'est ce qui permet à l'agent de corriger puis de prouver la correction. Sans identifiant stable, une re-mesure ne compare rien.",
        h3s: [
          { title: "Identifiant de règle", body: "Un code du type SEO-H1-001 ou GEO-ANSWER-001, invariant d'un audit à l'autre. C'est la clé qui rend la vérification possible." },
          { title: "Preuve", body: "L'extrait, la valeur mesurée et l'URL concernée. Un constat sans preuve n'est pas transmis à l'agent." },
          { title: "Gravité", body: "Critique, moyenne ou faible, calculée sur l'impact attendu et non sur l'ordre des règles. Claude traite d'abord les critiques." },
          { title: "Correction disponible", body: "Un booléen et la liste des piles supportées. L'agent sait immédiatement s'il peut appliquer un patch ou s'il doit arbitrer." },
        ],
        table: {
          caption: "Exemples de constats normalisés : gravité, preuve et piles couvertes par la correction.",
          columns: ["Identifiant", "Règle", "Gravité", "Preuve type", "Piles couvertes"],
          rows: [
            ["SEO-H1-001", "Un seul h1 par page", "Critique", "Aucun h1 dans le HTML servi", "HTML, WordPress, Next.js"],
            ["SEO-CANON-002", "Canonical présente et cohérente", "Critique", "Aucune balise canonical, page dupliquée en /?ref=", "HTML, WordPress, Next.js"],
            ["SEO-META-007", "Meta description utile", "Moyenne", "62 caractères, sous le seuil d'affichage", "HTML, WordPress, Next.js"],
            ["GEO-ANSWER-001", "Réponse directe citable", "Critique", "Aucun passage autonome de 2 à 4 phrases", "HTML, WordPress, Next.js"],
            ["GEO-FANOUT-004", "Couverture des sous-questions", "Moyenne", "7 sous-requêtes sans contenu correspondant", "Éditorial"],
          ],
        },
      },
      {
        h2: "Comment connecter Claude à Crawlers.fr",
        body: "Le serveur MCP de Crawlers.fr parle Streamable HTTP avec authentification OAuth 2.1, le standard attendu par Claude Desktop, Claude Code et les autres clients compatibles. Vous ajoutez le serveur dans votre client, vous autorisez votre compte Crawlers.fr, et les outils apparaissent dans la conversation. La facturation suit votre plan : les outils inclus consomment votre quota, le reste est décompté en pay-as-you-go depuis votre portefeuille développeur.",
        h3s: [
          { title: "Prérequis", body: "Un compte Crawlers.fr, un client MCP compatible Streamable HTTP, et l'autorisation OAuth accordée une fois depuis le client." },
          { title: "Plafond journalier", body: "Un plafond par compte arrête les boucles d'agent coûteuses. Chaque appel facturé est journalisé avec son coût dans l'espace développeurs." },
          { title: "Remboursement en cas d'échec", body: "Un job facturé qui échoue est recrédité automatiquement sur le portefeuille, avec la clé d'idempotence correspondante." },
        ],
        table: {
          caption: "Compatibilité des clients MCP avec le serveur Crawlers.fr.",
          columns: ["Client", "Transport", "Authentification", "Usage typique"],
          rows: [
            ["Claude Code", "Streamable HTTP", "OAuth 2.1", "Audit et correction dans le dépôt"],
            ["Claude Desktop", "Streamable HTTP", "OAuth 2.1", "Diagnostic conversationnel"],
            ["Cursor", "Streamable HTTP", "OAuth 2.1", "Audit pendant l'édition"],
            ["Client MCP conforme", "Streamable HTTP", "OAuth 2.1", "Automatisation sur mesure"],
          ],
        },
      },
    ],
    faqs: [
      { q: "Faut-il un abonnement Crawlers.fr pour utiliser Claude avec le MCP ?", a: "Il faut un compte Crawlers.fr. Les lectures et les statuts de tâche sont gratuits, les outils qui déclenchent un crawl ou un calcul sont décomptés du quota de votre plan puis, au-delà, de votre portefeuille pay-as-you-go." },
      { q: "Quels clients sont compatibles ?", a: "Tout client conforme au Model Context Protocol en transport Streamable HTTP avec OAuth 2.1 : Claude Desktop, Claude Code, Cursor et les environnements équivalents." },
      { q: "Claude modifie-t-il mon site directement ?", a: "Non. Crawlers.fr fournit les constats et les corrections proposées ; c'est votre agent, dans votre dépôt ou via votre CMS connecté, qui applique la modification." },
      { q: "Est-ce du SEO ou du GEO ?", a: "Les deux. Les outils mesurent la performance classique (technique, balises, maillage) et la citabilité par les moteurs génératifs comme ChatGPT, Gemini, Perplexity et Claude." },
      { q: "Comment éviter les boucles d'appels coûteuses ?", a: "Un plafond journalier s'applique par compte, et chaque appel facturé est journalisé avec son coût dans l'espace développeurs." },
      { q: "Que se passe-t-il si un appel échoue ?", a: "Le job est marqué en échec et le montant débité est recrédité sur le portefeuille développeur, sans intervention." },
    ],
    relatedLinks: [
      { label: "Serveur MCP SEO (page anglaise)", to: "/seo-mcp-server" },
      { label: "Serveur MCP GEO", to: "/geo-mcp-server" },
      { label: "Audit SEO par IA : ce qui est mesuré", to: "/audit-seo-par-ia" },
      { label: "Crawlers.fr vs Claude : comparatif", to: "/comparatif-claude-vs-crawlers" },
      { label: "API SEO REST et tarifs", to: "/api-seo" },
    ],
    externalRefs: [
      { label: "Spécification du Model Context Protocol", href: "https://modelcontextprotocol.io/specification", note: "Transport Streamable HTTP, outils, ressources et prompts." },
      { label: "Documentation MCP d'Anthropic", href: "https://docs.anthropic.com/en/docs/mcp", note: "Ajout d'un serveur MCP dans Claude Desktop et Claude Code." },
      { label: "Google Search Central — bonnes pratiques", href: "https://developers.google.com/search/docs", note: "Règles officielles sur canonical, indexation et données structurées." },
      { label: "Schema.org", href: "https://schema.org/docs/schemas.html", note: "Vocabulaire des données structurées vérifiées par analyze_schema." },
      { label: "Web Vitals", href: "https://web.dev/articles/vitals", note: "Définition de LCP, INP et CLS utilisés dans le score de performance." },
    ],
    datePublished: '2026-09-09',

  },
  'visibilite-ia': {
    slug: 'visibilite-ia',
    h1: 'Visibilité IA : mesurer si ChatGPT, Gemini et Perplexity citent votre marque',
    title: 'Visibilité IA — Mesurer vos citations dans les LLM | Crawlers.fr',
    metaDesc: "Visibilité IA : comment mesurer les citations de votre marque dans ChatGPT, Gemini, Perplexity, Claude et Mistral, et comment les faire progresser.",
    primaryKeyword: 'visibilité IA',
    intro: "La visibilité IA désigne la présence d'une marque dans les réponses des moteurs génératifs, là où le SEO classique mesure une position dans une page de résultats. Elle ne se déduit pas du classement Google : une page première sur un mot-clé peut n'être jamais citée par ChatGPT, et l'inverse arrive aussi.",
    sections: [
      {
        h2: "Visibilité IA, position Google : deux mesures distinctes",
        body: "Un moteur génératif ne renvoie pas dix liens mais une réponse, construite à partir de quelques sources. La question n'est plus « à quelle place suis-je ? » mais « suis-je la source retenue, et sur quelles questions ? ».",
        h3s: [
          { title: "L'unité de mesure change", body: "En SEO, on suit un mot-clé et un rang. En visibilité IA, on suit une question posée par un utilisateur et la présence, ou l'absence, de votre marque dans la réponse." },
          { title: "Le fan-out multiplie les questions", body: "Une demande utilisateur est éclatée par le modèle en plusieurs sous-questions. Être cité sur une seule d'entre elles suffit parfois, et manque parfois l'essentiel." },
          { title: "La citation se gagne sur des faits", body: "Les passages courts, datés, chiffrés et attribuables sont réutilisés plus souvent que les paragraphes promotionnels." },
        ],
      },
      {
        h2: "Comment mesurer sa visibilité IA sans se raconter d'histoires",
        body: "Une mesure crédible repose sur des interrogations réelles des moteurs, répétées dans le temps, sur un jeu de questions stable. Trois précautions comptent.",
        h3s: [
          { title: "Un jeu de questions représentatif", body: "Questions de marque, questions de catégorie, questions comparatives et, quand le périmètre local est prouvé, questions localisées. Un lieu n'est jamais supposé." },
          { title: "La répétition", body: "Les réponses des modèles varient. Une mesure isolée ne vaut rien ; c'est la fréquence de citation sur plusieurs passages qui fait signal." },
          { title: "Le croisement avec les faits techniques", body: "Un site rendu uniquement en JavaScript peut être quasi vide pour un robot. Dans ce cas, la cause d'une visibilité nulle est structurelle, pas éditoriale." },
        ],
      },
      {
        h2: "Les leviers qui font bouger la visibilité IA",
        body: "Aucun levier n'agit seul, mais leur ordre compte : rendre le contenu lisible par les robots, puis le rendre citable, puis le rendre reconnaissable.",
        h3s: [
          { title: "Accessibilité aux robots IA", body: "robots.txt, pare-feu, rendu serveur : si GPTBot, ClaudeBot ou PerplexityBot n'accèdent pas au contenu, rien d'autre ne compte." },
          { title: "Citabilité", body: "Réponse directe en tête de page, passages autonomes de deux à quatre phrases, données structurées cohérentes avec le texte visible." },
          { title: "Autorité vérifiable", body: "Auteur identifié, sources externes, dates de mise à jour, données propriétaires. Ce sont les signaux qu'un modèle peut reprendre sans risque." },
          { title: "Suivi des passages de bots", body: "Les logs montrent quels robots IA lisent quoi. Une hausse de passages précède souvent une hausse de citations." },
        ],
      },
      {
        h2: "Ce que Crawlers.fr mesure",
        body: "L'audit Crawlers.fr interroge réellement les moteurs génératifs sur un jeu de questions construit à partir de la page auditée, mesure les passages de robots IA dans vos logs, et plafonne le score de visibilité quand les faits techniques le contredisent : un texte extrait quasi nul ne peut pas produire un bon score, quelle que soit la qualité apparente du contenu.",
      },
    ],
    faqs: [
      { q: "La visibilité IA remplace-t-elle le SEO ?", a: "Non. Le trafic de recherche classique reste majoritaire pour la plupart des sites. La visibilité IA est une seconde surface, qui se dégrade ou progresse indépendamment." },
      { q: "Peut-on mesurer la visibilité IA gratuitement ?", a: "Oui, l'audit gratuit de Crawlers.fr interroge les principaux moteurs génératifs sur une page et restitue les citations observées." },
      { q: "Pourquoi mes concurrents sont-ils cités et pas moi ?", a: "Le plus souvent pour une raison mesurable : contenu inaccessible aux robots, absence de passages autonomes, ou aucune donnée propre à reprendre. L'audit indique laquelle s'applique." },
      { q: "Combien de temps pour voir un effet ?", a: "Les corrections d'accessibilité produisent un effet en quelques jours, le temps que les robots repassent. Les gains de citabilité se constatent plutôt sur quatre à huit semaines." },
      { q: "Les citations IA génèrent-elles du trafic ?", a: "Partiellement, et de façon inégale selon les moteurs. Certains affichent des liens cliquables, d'autres non : la citation vaut alors surtout comme recommandation." },
    ],
    relatedLinks: [
      { label: "Référencement IA et GEO : le guide pilier", to: "/generative-engine-optimization" },
      { label: "Audit GEO gratuit", to: "/audit-geo" },
      { label: "Monitoring GPTBot et PerplexityBot", to: "/monitoring-gptbot-perplexity" },
      { label: "E-E-A-T et citations IA", to: "/eeat" },
    ],
    datePublished: '2026-09-09',
  },
  'audit-seo-par-ia': {
    slug: 'audit-seo-par-ia',
    h1: 'Audit SEO par IA : ce que la machine mesure, ce qu’elle invente',
    title: 'Audit SEO par IA — Ce qui est mesuré | Crawlers.fr',
    metaDesc: "Audit SEO par IA : différence entre constats mesurés et texte généré, méthode Crawlers.fr, garde-fous anti-hallucination et plan d'action priorisé.",
    primaryKeyword: 'audit SEO par IA',
    intro: "Un audit SEO par IA n'a de valeur que si le diagnostic vient de mesures et non du modèle. Chez Crawlers.fr, les constats sont produits par un crawl et des règles déterministes ; l'IA sert à expliquer, prioriser et rédiger les corrections, jamais à inventer un chiffre.",
    sections: [
      {
        h2: "Deux choses très différentes appelées « audit SEO par IA »",
        body: "La confusion est fréquente et coûteuse : un rapport bien écrit peut être entièrement faux.",
        h3s: [
          { title: "Le rapport rédigé par un modèle", body: "Un modèle reçoit une URL, produit un texte crédible. Sans crawl, il ne peut ni compter les pages, ni mesurer un temps de chargement, ni vérifier un canonical." },
          { title: "L'audit mesuré, expliqué par un modèle", body: "Le crawl et les règles produisent les faits. Le modèle les met en récit, les hiérarchise et propose les correctifs. C'est l'approche de Crawlers.fr." },
        ],
      },
      {
        h2: "Ce qui est réellement mesuré",
        body: "Chaque constat est rattaché à une règle, une preuve et une gravité. Sans preuve, pas de constat.",
        h3s: [
          { title: "Technique", body: "Statuts HTTP, canonicals, robots.txt, sitemap, redirections, hreflang, poids et format des images, Core Web Vitals sur données réelles quand elles existent." },
          { title: "Rendu robot", body: "Comparaison du HTML servi et du contenu après rendu. Une page dont le texte n'existe qu'après exécution JavaScript est signalée comme cause racine, pas comme contenu pauvre." },
          { title: "Sémantique et maillage", body: "Structure des titres, intention de page, cannibalisation entre pages proches, profondeur de clic, liens internes entrants." },
          { title: "Citabilité et autorité", body: "Passages citables, données structurées, signaux E-E-A-T vérifiables, citations observées dans les moteurs génératifs." },
        ],
      },
      {
        h2: "Les garde-fous",
        body: "Un audit automatisé se juge autant sur ce qu'il refuse d'affirmer que sur ce qu'il détecte.",
        h3s: [
          { title: "Aucun chiffre non mesuré", body: "La synthèse ne peut citer que des valeurs issues des mesures. Un chiffre absent des données ne peut pas apparaître dans le rapport." },
          { title: "Plafonds de cohérence", body: "Les scores sont plafonnés par les faits : un site dont le texte extrait est quasi nul ne peut pas afficher un bon score, même si le reste semble propre." },
          { title: "Priorisation par impact", body: "Les problèmes bloquants passent devant les optimisations de confort, et le plan d'action est ordonné par gain attendu, pas par ordre alphabétique des règles." },
        ],
      },
      {
        h2: "Du constat à la correction vérifiée",
        body: "Chaque constat porte un identifiant stable, ce qui permet de suivre sa disparition après correction. C'est cette boucle qui rend l'audit utilisable par un agent de développement : audit, correction adaptée à votre pile, nouvel audit, comparaison. Le même mécanisme alimente l'espace développeurs, l'API et le serveur MCP.",
      },
    ],
    faqs: [
      { q: "Un audit SEO par IA remplace-t-il un consultant ?", a: "Il remplace la collecte et le tri, pas l'arbitrage. Le choix de ce qu'on corrige d'abord dépend d'objectifs commerciaux que l'outil ne connaît pas." },
      { q: "L'audit gratuit est-il limité ?", a: "Il porte sur une page et un jeu de questions réduit. L'audit complet couvre le site, les logs et le suivi dans le temps." },
      { q: "Comment savoir si un audit invente des données ?", a: "Demandez la preuve associée à chaque constat : URL, extrait, valeur mesurée, date. Un constat sans preuve n'est pas un constat." },
      { q: "L'audit détecte-t-il les sites en JavaScript non rendu côté serveur ?", a: "Oui, c'est un contrôle explicite : le rapport distingue une coquille JavaScript d'un contenu réellement insuffisant." },
      { q: "Peut-on relancer l'audit après correction ?", a: "Oui, et c'est l'usage recommandé : la comparaison entre deux audits est la seule preuve qu'une correction a produit un effet." },
    ],
    relatedLinks: [
      { label: "Méthode d’audit SEO GEO", to: "/audit-seo-geo" },
      { label: "SEO avec Claude via MCP", to: "/seo-avec-claude" },
      { label: "Visibilité IA : mesurer ses citations", to: "/visibilite-ia" },
      { label: "Audit expert 200+ critères", to: "/audit-expert" },
    ],
    datePublished: '2026-09-09',
  },
};

export const PILLAR_SLUGS = Object.keys(KEYWORD_PILLARS);
