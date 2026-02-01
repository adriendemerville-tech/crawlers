// Configuration du maillage interne entre articles de blog
// Chaque article a 2-3 articles connexes + 1-2 termes du lexique

export interface InternalLink {
  slug: string;
  title: { fr: string; en: string; es: string };
  description: { fr: string; en: string; es: string };
}

export interface LexiqueLink {
  term: string;
  anchor: string;
  description: { fr: string; en: string; es: string };
}

export interface ArticleLinks {
  relatedArticles: InternalLink[];
  lexiqueTerms: LexiqueLink[];
}

// Map des liens internes par slug d'article
export const articleInternalLinks: Record<string, ArticleLinks> = {
  // PILIER 1: Guide Visibilité Technique
  'guide-visibilite-technique-ia': {
    relatedArticles: [
      {
        slug: 'bloquer-autoriser-gptbot',
        title: {
          fr: 'Faut-il bloquer ou autoriser GPTBot ?',
          en: 'Should You Block or Allow GPTBot?',
          es: '¿Bloquear o Permitir GPTBot?',
        },
        description: {
          fr: 'Guide détaillé sur la configuration optimale du robots.txt pour les bots IA',
          en: 'Detailed guide on optimal robots.txt configuration for AI bots',
          es: 'Guía detallada sobre la configuración óptima del robots.txt para bots IA',
        },
      },
      {
        slug: 'json-ld-snippet-autorite',
        title: {
          fr: 'JSON-LD : Le snippet qui fait de vous une autorité',
          en: 'JSON-LD: The Snippet That Makes You an Authority',
          es: 'JSON-LD: El snippet que te convierte en autoridad',
        },
        description: {
          fr: 'Maîtrisez le format de données structurées préféré des LLM',
          en: 'Master the structured data format preferred by LLMs',
          es: 'Domina el formato de datos estructurados preferido por los LLM',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'JSON-LD',
        anchor: 'json-ld',
        description: {
          fr: 'Le format de données structurées recommandé par Google',
          en: 'The structured data format recommended by Google',
          es: 'El formato de datos estructurados recomendado por Google',
        },
      },
      {
        term: 'Robots.txt',
        anchor: 'robots-txt',
        description: {
          fr: 'Fichier de configuration pour les crawlers web',
          en: 'Configuration file for web crawlers',
          es: 'Archivo de configuración para crawlers web',
        },
      },
    ],
  },

  // PILIER 2: Comprendre GEO vs SEO
  'comprendre-geo-vs-seo': {
    relatedArticles: [
      {
        slug: 'tableau-comparatif-seo-geo-2026',
        title: {
          fr: 'SEO vs GEO : Le tableau comparatif définitif',
          en: 'SEO vs GEO: The Definitive Comparison',
          es: 'SEO vs GEO: La comparativa definitiva',
        },
        description: {
          fr: 'Comparaison point par point pour arbitrer vos investissements',
          en: 'Point-by-point comparison to guide your investments',
          es: 'Comparación punto por punto para guiar tus inversiones',
        },
      },
      {
        slug: 'google-sge-seo-preparation',
        title: {
          fr: 'Google SGE : Pourquoi votre SEO actuel ne suffira plus',
          en: 'Google SGE: Why Your Current SEO Won\'t Be Enough',
          es: 'Google SGE: Por qué tu SEO actual no será suficiente',
        },
        description: {
          fr: 'Préparez-vous à la Search Generative Experience',
          en: 'Prepare for the Search Generative Experience',
          es: 'Prepárate para la Search Generative Experience',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'GEO',
        anchor: 'geo',
        description: {
          fr: 'Generative Engine Optimization - L\'optimisation pour les moteurs génératifs',
          en: 'Generative Engine Optimization - Optimization for generative engines',
          es: 'Generative Engine Optimization - Optimización para motores generativos',
        },
      },
      {
        term: 'SGE',
        anchor: 'sge',
        description: {
          fr: 'Search Generative Experience - La nouvelle interface de recherche Google',
          en: 'Search Generative Experience - Google\'s new search interface',
          es: 'Search Generative Experience - La nueva interfaz de búsqueda de Google',
        },
      },
    ],
  },

  // PILIER 3: Vendre audit IA clients
  'vendre-audit-ia-clients': {
    relatedArticles: [
      {
        slug: 'mission-mise-aux-normes-ia',
        title: {
          fr: 'Comment vendre une mission \'Mise aux normes IA\'',
          en: 'How to Sell an \'AI Compliance\' Mission',
          es: 'Cómo vender una misión \'Cumplimiento IA\'',
        },
        description: {
          fr: 'Le pitch commercial parfait pour 2026',
          en: 'The perfect sales pitch for 2026',
          es: 'El pitch comercial perfecto para 2026',
        },
      },
      {
        slug: 'audit-seo-gratuit-vs-semrush',
        title: {
          fr: 'Audit SEO Gratuit vs outils classiques',
          en: 'Free SEO Audit vs Classic Tools',
          es: 'Auditoría SEO Gratis vs herramientas clásicas',
        },
        description: {
          fr: 'Pourquoi Semrush et Ahrefs ratent l\'IA',
          en: 'Why Semrush and Ahrefs miss AI',
          es: 'Por qué Semrush y Ahrefs fallan con la IA',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Audit GEO',
        anchor: 'audit-geo',
        description: {
          fr: 'Analyse de la conformité IA d\'un site web',
          en: 'AI compliance analysis of a website',
          es: 'Análisis de conformidad IA de un sitio web',
        },
      },
    ],
  },

  // SATELLITES
  'bloquer-autoriser-gptbot': {
    relatedArticles: [
      {
        slug: 'guide-visibilite-technique-ia',
        title: {
          fr: 'Le Guide Ultime de la Visibilité Technique',
          en: 'The Ultimate Guide to Technical Visibility',
          es: 'La Guía Definitiva de Visibilidad Técnica',
        },
        description: {
          fr: 'Robots.txt, JSON-LD et Sitemaps pour 2026',
          en: 'Robots.txt, JSON-LD and Sitemaps for 2026',
          es: 'Robots.txt, JSON-LD y Sitemaps para 2026',
        },
      },
      {
        slug: 'liste-user-agents-ia-2026',
        title: {
          fr: 'La liste complète des User-Agents IA',
          en: 'Complete List of AI User-Agents',
          es: 'Lista completa de User-Agents IA',
        },
        description: {
          fr: 'Tous les identifiants des robots d\'IA à connaître',
          en: 'All AI robot identifiers you need to know',
          es: 'Todos los identificadores de robots IA que necesitas conocer',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'GPTBot',
        anchor: 'gptbot',
        description: {
          fr: 'Le crawler d\'OpenAI pour l\'entraînement des modèles',
          en: 'OpenAI\'s crawler for model training',
          es: 'El crawler de OpenAI para entrenamiento de modelos',
        },
      },
    ],
  },

  'site-invisible-chatgpt-solutions': {
    relatedArticles: [
      {
        slug: 'guide-visibilite-technique-ia',
        title: {
          fr: 'Le Guide Ultime de la Visibilité Technique',
          en: 'The Ultimate Guide to Technical Visibility',
          es: 'La Guía Definitiva de Visibilidad Técnica',
        },
        description: {
          fr: 'Les 3 piliers de l\'infrastructure GEO',
          en: 'The 3 pillars of GEO infrastructure',
          es: 'Los 3 pilares de la infraestructura GEO',
        },
      },
      {
        slug: 'bloquer-autoriser-gptbot',
        title: {
          fr: 'Faut-il bloquer ou autoriser GPTBot ?',
          en: 'Should You Block or Allow GPTBot?',
          es: '¿Bloquear o Permitir GPTBot?',
        },
        description: {
          fr: 'Le guide de survie du robots.txt',
          en: 'The robots.txt survival guide',
          es: 'La guía de supervivencia del robots.txt',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Crawl Budget',
        anchor: 'crawl-budget',
        description: {
          fr: 'Le budget d\'exploration alloué par les moteurs',
          en: 'The crawl budget allocated by search engines',
          es: 'El presupuesto de rastreo asignado por los motores',
        },
      },
    ],
  },

  'google-sge-seo-preparation': {
    relatedArticles: [
      {
        slug: 'comprendre-geo-vs-seo',
        title: {
          fr: 'Comprendre et Dompter le GEO',
          en: 'Understanding and Mastering GEO',
          es: 'Comprender y Dominar el GEO',
        },
        description: {
          fr: 'La fin du mot-clé et le nouveau paradigme',
          en: 'The end of keywords and the new paradigm',
          es: 'El fin de las palabras clave y el nuevo paradigma',
        },
      },
      {
        slug: 'perplexity-seo-citation',
        title: {
          fr: 'Perplexity SEO : Devenir la source n°1',
          en: 'Perplexity SEO: Becoming the #1 Source',
          es: 'Perplexity SEO: Convertirse en la fuente n°1',
        },
        description: {
          fr: 'Comment être cité par le moteur des décideurs',
          en: 'How to be cited by the decision-makers\' engine',
          es: 'Cómo ser citado por el motor de los decisores',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Featured Snippet',
        anchor: 'featured-snippet',
        description: {
          fr: 'La position zéro dans les résultats Google',
          en: 'Position zero in Google results',
          es: 'La posición cero en los resultados de Google',
        },
      },
    ],
  },

  'mission-mise-aux-normes-ia': {
    relatedArticles: [
      {
        slug: 'vendre-audit-ia-clients',
        title: {
          fr: 'Comment auditer et vendre la conformité IA',
          en: 'How to Audit and Sell AI Compliance',
          es: 'Cómo Auditar y Vender la Conformidad IA',
        },
        description: {
          fr: 'La feuille de route pour intégrer l\'offre IA',
          en: 'The roadmap to integrate the AI offer',
          es: 'La hoja de ruta para integrar la oferta IA',
        },
      },
      {
        slug: 'eeat-expertise-algorithme',
        title: {
          fr: 'E-E-A-T : Prouver votre expertise',
          en: 'E-E-A-T: Proving Your Expertise',
          es: 'E-E-A-T: Demostrar tu experiencia',
        },
        description: {
          fr: 'Les critères techniques de crédibilité',
          en: 'The technical credibility criteria',
          es: 'Los criterios técnicos de credibilidad',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'E-E-A-T',
        anchor: 'e-e-a-t',
        description: {
          fr: 'Experience, Expertise, Authoritativeness, Trustworthiness',
          en: 'Experience, Expertise, Authoritativeness, Trustworthiness',
          es: 'Experience, Expertise, Authoritativeness, Trustworthiness',
        },
      },
    ],
  },

  'json-ld-snippet-autorite': {
    relatedArticles: [
      {
        slug: 'guide-visibilite-technique-ia',
        title: {
          fr: 'Le Guide Ultime de la Visibilité Technique',
          en: 'The Ultimate Guide to Technical Visibility',
          es: 'La Guía Definitiva de Visibilidad Técnica',
        },
        description: {
          fr: 'Les 3 piliers de l\'infrastructure GEO',
          en: 'The 3 pillars of GEO infrastructure',
          es: 'Los 3 pilares de la infraestructura GEO',
        },
      },
      {
        slug: 'eeat-expertise-algorithme',
        title: {
          fr: 'E-E-A-T : Prouver votre expertise',
          en: 'E-E-A-T: Proving Your Expertise',
          es: 'E-E-A-T: Demostrar tu experiencia',
        },
        description: {
          fr: 'Les critères techniques de crédibilité',
          en: 'The technical credibility criteria',
          es: 'Los criterios técnicos de credibilidad',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Schema.org',
        anchor: 'schema-org',
        description: {
          fr: 'Le vocabulaire standard pour les données structurées',
          en: 'The standard vocabulary for structured data',
          es: 'El vocabulario estándar para datos estructurados',
        },
      },
    ],
  },

  'perplexity-seo-citation': {
    relatedArticles: [
      {
        slug: 'comprendre-geo-vs-seo',
        title: {
          fr: 'Comprendre et Dompter le GEO',
          en: 'Understanding and Mastering GEO',
          es: 'Comprender y Dominar el GEO',
        },
        description: {
          fr: 'Pourquoi être cité remplace être cliqué',
          en: 'Why being cited replaces being clicked',
          es: 'Por qué ser citado reemplaza ser clicado',
        },
      },
      {
        slug: 'google-sge-seo-preparation',
        title: {
          fr: 'Google SGE arrive',
          en: 'Google SGE is Coming',
          es: 'Google SGE llega',
        },
        description: {
          fr: 'Préparez-vous à la Search Generative Experience',
          en: 'Prepare for the Search Generative Experience',
          es: 'Prepárate para la Search Generative Experience',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Citation IA',
        anchor: 'citation-ia',
        description: {
          fr: 'Être référencé comme source par un LLM',
          en: 'Being referenced as a source by an LLM',
          es: 'Ser referenciado como fuente por un LLM',
        },
      },
    ],
  },

  'audit-seo-gratuit-vs-semrush': {
    relatedArticles: [
      {
        slug: 'vendre-audit-ia-clients',
        title: {
          fr: 'Comment auditer et vendre la conformité IA',
          en: 'How to Audit and Sell AI Compliance',
          es: 'Cómo Auditar y Vender la Conformidad IA',
        },
        description: {
          fr: 'La nouvelle offre de service pour 2026',
          en: 'The new service offering for 2026',
          es: 'La nueva oferta de servicio para 2026',
        },
      },
      {
        slug: 'tableau-comparatif-seo-geo-2026',
        title: {
          fr: 'SEO vs GEO : Le tableau comparatif',
          en: 'SEO vs GEO: The Comparison Table',
          es: 'SEO vs GEO: La tabla comparativa',
        },
        description: {
          fr: 'Arbitrez vos budgets marketing',
          en: 'Guide your marketing budget decisions',
          es: 'Arbitra tus presupuestos de marketing',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Audit SEO',
        anchor: 'audit-seo',
        description: {
          fr: 'Analyse technique et stratégique d\'un site',
          en: 'Technical and strategic website analysis',
          es: 'Análisis técnico y estratégico de un sitio',
        },
      },
    ],
  },

  'tableau-comparatif-seo-geo-2026': {
    relatedArticles: [
      {
        slug: 'comprendre-geo-vs-seo',
        title: {
          fr: 'Comprendre et Dompter le GEO',
          en: 'Understanding and Mastering GEO',
          es: 'Comprender y Dominar el GEO',
        },
        description: {
          fr: 'Le changement de paradigme expliqué',
          en: 'The paradigm shift explained',
          es: 'El cambio de paradigma explicado',
        },
      },
      {
        slug: 'google-sge-seo-preparation',
        title: {
          fr: 'Google SGE : Pourquoi votre SEO actuel ne suffira plus',
          en: 'Google SGE: Why Your Current SEO Won\'t Be Enough',
          es: 'Google SGE: Por qué tu SEO actual no será suficiente',
        },
        description: {
          fr: 'La Search Generative Experience change les règles',
          en: 'The Search Generative Experience changes the rules',
          es: 'La Search Generative Experience cambia las reglas',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'KPI SEO',
        anchor: 'kpi-seo',
        description: {
          fr: 'Les indicateurs clés de performance du référencement',
          en: 'Key performance indicators for SEO',
          es: 'Indicadores clave de rendimiento SEO',
        },
      },
    ],
  },

  'liste-user-agents-ia-2026': {
    relatedArticles: [
      {
        slug: 'bloquer-autoriser-gptbot',
        title: {
          fr: 'Faut-il bloquer ou autoriser GPTBot ?',
          en: 'Should You Block or Allow GPTBot?',
          es: '¿Bloquear o Permitir GPTBot?',
        },
        description: {
          fr: 'Le guide de survie du robots.txt',
          en: 'The robots.txt survival guide',
          es: 'La guía de supervivencia del robots.txt',
        },
      },
      {
        slug: 'guide-visibilite-technique-ia',
        title: {
          fr: 'Le Guide Ultime de la Visibilité Technique',
          en: 'The Ultimate Guide to Technical Visibility',
          es: 'La Guía Definitiva de Visibilidad Técnica',
        },
        description: {
          fr: 'Infrastructure complète pour 2026',
          en: 'Complete infrastructure for 2026',
          es: 'Infraestructura completa para 2026',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'User-Agent',
        anchor: 'user-agent',
        description: {
          fr: 'L\'identifiant envoyé par les navigateurs et crawlers',
          en: 'The identifier sent by browsers and crawlers',
          es: 'El identificador enviado por navegadores y crawlers',
        },
      },
    ],
  },

  'eeat-expertise-algorithme': {
    relatedArticles: [
      {
        slug: 'json-ld-snippet-autorite',
        title: {
          fr: 'JSON-LD : Le snippet qui fait de vous une autorité',
          en: 'JSON-LD: The Snippet That Makes You an Authority',
          es: 'JSON-LD: El snippet que te convierte en autoridad',
        },
        description: {
          fr: 'Structurer vos données pour les LLM',
          en: 'Structure your data for LLMs',
          es: 'Estructura tus datos para los LLM',
        },
      },
      {
        slug: 'vendre-audit-ia-clients',
        title: {
          fr: 'Comment auditer et vendre la conformité IA',
          en: 'How to Audit and Sell AI Compliance',
          es: 'Cómo Auditar y Vender la Conformidad IA',
        },
        description: {
          fr: 'L\'E-E-A-T comme argument commercial',
          en: 'E-E-A-T as a sales argument',
          es: 'E-E-A-T como argumento comercial',
        },
      },
    ],
    lexiqueTerms: [
      {
        term: 'Autorité de domaine',
        anchor: 'autorite-domaine',
        description: {
          fr: 'La crédibilité d\'un site aux yeux des moteurs',
          en: 'A site\'s credibility in the eyes of search engines',
          es: 'La credibilidad de un sitio a ojos de los motores',
        },
      },
    ],
  },
};

// Fonction helper pour obtenir les liens d'un article
export function getArticleLinks(slug: string): ArticleLinks | undefined {
  return articleInternalLinks[slug];
}
