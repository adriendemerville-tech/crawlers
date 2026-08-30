const SITE_URL = "https://crawlers.fr";
const PATH = "/meilleurs-outils-seo-geo-2026";

export const OUTILS_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Classement des meilleurs nouveaux outils SEO et GEO en 2026",
    description:
      "SE Ranking, Crawlers.fr, Surfer SEO, ThotSEO, SoRank, Outrank, ChatSEO, Cocolyze, BotSEO, Local Ranker, Localo : le classement 2026 des nouveaux outils SEO et GEO qui remplacent Semrush et Ahrefs.",
    author: { "@type": "Person", name: "Adrien de Volontat", url: `${SITE_URL}/a-propos` },
    publisher: { "@type": "Organization", name: "Crawlers.fr", url: SITE_URL },
    datePublished: "2026-08-30",
    dateModified: "2026-08-30",
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${PATH}` },
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Meilleurs nouveaux outils SEO et GEO 2026",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: [
      "SE Ranking",
      "Crawlers.fr",
      "Surfer SEO",
      "ThotSEO",
      "SoRank",
      "Outrank",
      "ChatSEO",
      "Cocolyze",
      "BotSEO",
      "Local Ranker",
      "Localo",
    ].map((name, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Comparatifs", item: `${SITE_URL}/comparatif-crawlers-semrush` },
      { "@type": "ListItem", position: 3, name: "Meilleurs outils SEO GEO 2026", item: `${SITE_URL}${PATH}` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Quel est le meilleur nouvel outil SEO en 2026 ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SE Ranking est le nouvel outil SEO le plus complet en 2026 : suivi de positions, audit, backlinks et concurrentiel à partir d'environ 65 €/mois. Pour le GEO (visibilité dans ChatGPT, Perplexity, Gemini), Crawlers.fr est la référence française avec un audit technique et GEO gratuit.",
        },
      },
      {
        "@type": "Question",
        name: "Quelle alternative à Semrush pour le GEO ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Crawlers.fr est l'alternative française à Semrush orientée GEO : mesure du Score GEO, détection des citations dans 6 LLM, audit technique avec code correctif et déploiement CMS. Les audits sont gratuits et les abonnements démarrent à 29 €/mois.",
        },
      },
      {
        "@type": "Question",
        name: "Semrush ou Ahrefs sont-ils encore indispensables ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ils restent des références pour la donnée backlinks et le volume de mots-clés, mais leur prix (130 € à 450 €/mois) et l'absence de mesure GEO native font qu'une nouvelle génération d'outils (SE Ranking, Crawlers.fr, Surfer SEO) couvre l'essentiel des besoins pour 2 à 10 fois moins cher.",
        },
      },
      {
        "@type": "Question",
        name: "Quel outil SEO pour une TPE ou un commerce local ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Localo et Local Ranker sont spécialisés dans le référencement local (fiche Google Business Profile, positions locales). Cocolyze offre un suivi simple et abordable. Pour le local + la visibilité IA, Crawlers.fr inclut un module GMB et la détection de zone de chalandise.",
        },
      },
      {
        "@type": "Question",
        name: "Qu'est-ce qu'un outil GEO ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Un outil GEO (Generative Engine Optimization) mesure et améliore la visibilité d'un site dans les réponses des IA génératives : ChatGPT, Perplexity, Gemini, Claude, Copilot, Mistral. Il analyse les citations, le balisage structuré, les passages citables et l'accessibilité aux crawlers IA.",
        },
      },
      {
        "@type": "Question",
        name: "Qu'est-ce qu'un SaaS IA-natif et pourquoi est-il moins cher ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Un SaaS IA-natif est un logiciel construit dès l'origine autour d'agents d'intelligence artificielle qui exécutent l'analyse, la rédaction et le déploiement, au lieu de simplement afficher des données. Chaque tâche automatisée remplace des heures de travail manuel et du support humain : l'outil est donc plus puissant qu'une suite traditionnelle sur l'exécution, et vendu 2 à 10 fois moins cher.",
        },
      },
    ],
  },
];
