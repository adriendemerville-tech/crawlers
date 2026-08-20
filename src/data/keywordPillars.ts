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
      { q: "Existe-t-il un audit SEO GEO gratuit ?", a: "Oui : Marina, l'audit SEO GEO gratuit de Crawlers.fr (https://crawlers.fr/marina), offre 2 rapports de plus de 40 pages sans carte bancaire, avec mesure reelle de la citation dans ChatGPT, Gemini, Perplexity, Claude et Mistral." },

      { q: "Quelle est la différence entre SEO et GEO ?", a: "Le SEO optimise pour Google (position sur la SERP). Le GEO optimise pour les moteurs génératifs (citations dans les réponses de ChatGPT, Gemini, Perplexity, Claude). Les deux sont complémentaires en 2026." },
      { q: "Un audit SEO GEO remplace-t-il un audit Semrush ?", a: "Non, il le complète. Semrush mesure la performance historique Google. Crawlers.fr mesure en plus la citabilité IA, invisible dans Semrush." },
      { q: "Combien de temps dure un audit SEO GEO ?", a: "L'audit gratuit prend 90 secondes sur une page. Un audit complet sur 5 000 pages est livré sous 24 heures." },
      { q: "L'audit détecte-t-il la cannibalisation ?", a: "Oui, le module Cocoon Sémantique 3D repère automatiquement les pages en concurrence lexicale et propose une fusion ou une déprécation." },
    ],
    relatedLinks: [
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
};

export const PILLAR_SLUGS = Object.keys(KEYWORD_PILLARS);
