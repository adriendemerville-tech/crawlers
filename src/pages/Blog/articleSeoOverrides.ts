/**
 * Surcharges SEO par article, isolées du composant : la route blog/$slug les lit
 * dans head() (code critique). Les importer depuis ArticlePage tirait tout
 * articleContents (392 Ko) dans le bundle initial de chaque visiteur.
 */
export const ARTICLE_SEO_OVERRIDES: Record<string, {
  title: string;
  description: string;
  ogTitle?: string;
}> = {
  'bloquer-autoriser-gptbot': {
    title: "Guide 2026 : Maîtriser GPTBot et les Crawlers IA | Crawlers.fr",
    description: "Guide complet : Comment configurer robots.txt pour GPTBot, ClaudeBot et Google-Extended. Avantages et risques pour votre SEO et GEO.",
    ogTitle: "Guide GPTBot & Crawlers IA 2026"
  },
  'crawler-definition-seo-geo': {
    title: "Un crawler c'est quoi ? Définition, rôle en SEO et GEO | Crawlers.fr",
    description: "Découvrez ce qu'est un crawler web : son histoire, son rôle crucial pour le SEO et le GEO, et pourquoi les crawlers IA changent la donne en 2026.",
    ogTitle: "Crawler Web : Définition Complète 2026"
  },
  'guide-visibilite-technique-ia': {
    title: "Robots.txt, JSON-LD, Sitemaps : Guide Technique Visibilité IA 2026 | Crawlers.fr",
    description: "Le guide ultime pour optimiser votre infrastructure technique : robots.txt, JSON-LD et sitemaps. Soyez visible sur Google ET sur les IA génératives.",
    ogTitle: "Guide Technique Visibilité IA 2026"
  },
  'comprendre-geo-vs-seo': {
    title: "GEO vs SEO : Comprendre le Generative Engine Optimization | Crawlers.fr",
    description: "Le SEO consistait à être trouvé. Le GEO consiste à être cité. Découvrez comment adapter votre stratégie pour ChatGPT, Gemini et Perplexity.",
    ogTitle: "GEO vs SEO : Le Match 2026"
  },
  'vendre-audit-ia-clients': {
    title: "Consultants : Comment vendre des audits GEO à vos clients | Crawlers.fr",
    description: "Feuille de route pour intégrer l'offre Visibilité IA à votre catalogue de services. Argumentaire, pricing et livrables pour audits GEO.",
    ogTitle: "Vendre des Audits GEO : Guide Consultant"
  },
  'site-invisible-chatgpt-solutions': {
    title: "Site invisible sur ChatGPT ? 3 erreurs techniques à corriger | Crawlers.fr",
    description: "Votre site n'apparaît pas dans les réponses de ChatGPT ? Découvrez les 3 erreurs techniques fatales et comment les corriger immédiatement.",
    ogTitle: "Invisible sur ChatGPT ? Voici pourquoi"
  },
  'google-sge-seo-preparation': {
    title: "Google SGE : Préparer son SEO à la Search Generative Experience | Crawlers.fr",
    description: "La SGE de Google change les règles du jeu SEO. Découvrez comment adapter votre stratégie pour gagner la position Zéro en 2026.",
    ogTitle: "Google SGE : Guide de Préparation SEO"
  },
  'mission-mise-aux-normes-ia': {
    title: "Consultants : Vendre une mission Mise aux normes IA (GEO) | Crawlers.fr",
    description: "Ne vendez plus du vent, vendez de la sécurité infrastructurelle. Comment pitcher et pricer une mission de conformité IA en 2026.",
    ogTitle: "Mission Mise aux Normes IA : Guide"
  },
  'json-ld-chatgpt-visibility': {
    title: "JSON-LD : Le secret pour être cité par ChatGPT et les IA | Crawlers.fr",
    description: "Le JSON-LD est la langue maternelle des LLM. Apprenez à structurer vos données pour maximiser vos citations dans les réponses IA.",
    ogTitle: "JSON-LD : Booster sa Visibilité IA"
  },
  'perplexity-ai-seo-strategy': {
    title: "Perplexity AI : Stratégie SEO pour être cité en source | Crawlers.fr",
    description: "Comment optimiser votre site pour apparaître comme source dans les réponses Perplexity. Stratégies GEO spécifiques 2026.",
    ogTitle: "Perplexity AI : Stratégie de Citation"
  },
  'llms-txt-specification': {
    title: "llms.txt : La nouvelle spécification pour les crawlers IA | Crawlers.fr",
    description: "Découvrez llms.txt, le nouveau standard qui permet de communiquer avec les LLM. Comment l'implémenter et pourquoi c'est crucial pour le GEO.",
    ogTitle: "llms.txt : Guide d'Implémentation"
  },
  'ai-plugin-json-chatgpt': {
    title: "ai-plugin.json : Rendre son site accessible à ChatGPT Plugins | Crawlers.fr",
    description: "Guide technique pour créer votre fichier ai-plugin.json et rendre votre site compatible avec l'écosystème ChatGPT Plugins.",
    ogTitle: "ai-plugin.json : Guide ChatGPT Plugins"
  },
  'paradoxe-google-geo-2026': {
    title: "96% de part de marché, 45% de clics en moins : Le paradoxe Google et l'avènement du GEO en 2026 | Crawlers.fr",
    description: "Google domine l'infrastructure avec 96% de part de marché, mais le GEO capte 45% de l'intention de recherche. Analyse du paradoxe et stratégies pour 2026.",
    ogTitle: "Paradoxe Google & GEO 2026"
  },
  'share-of-voice-llm-illusion': {
    title: "Share of Voice LLM : pourquoi c'est une illusion statistique en 2026 | Crawlers.fr",
    description: "La Share of Voice sur les LLMs est une illusion. Sans données de volume réelles d'OpenAI ou Anthropic, les outils vendent de l'estimation en laboratoire. Analyse technique.",
    ogTitle: "Share of Voice LLM : L'Illusion Statistique"
  },
  'reddit-tromper-bots-ia-seo-geo': {
    title: "Reddit, meilleur outil SEO GEO 2026 : tromper les bots des IA (méthode) | Crawlers.fr",
    description: "Reddit = 62% des sources citées par ChatGPT et Perplexity en 2026. Méthode complète pour manipuler les bots IA via Reddit sans se faire bannir : compte, subreddits, seeding, mesures GEO.",
    ogTitle: "Reddit : meilleur outil SEO GEO 2026"
  },
};
