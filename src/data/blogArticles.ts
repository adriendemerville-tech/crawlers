export interface BlogArticle {
  slug: string;
  title: { fr: string; en: string; es: string };
  description: { fr: string; en: string; es: string };
  heroImage: string;
  heroAlt: { fr: string; en: string; es: string };
  author: string;
  date: string;
  summaryPoints: { fr: string[]; en: string[]; es: string[] };
  sources: Array<{ title: string; url: string }>;
}

// Template article - à dupliquer pour chaque nouvel article
export const blogArticles: BlogArticle[] = [
  {
    slug: 'seo-vs-geo-differences',
    title: {
      fr: 'SEO vs GEO : Quelles différences en 2025 ?',
      en: 'SEO vs GEO: What are the differences in 2025?',
      es: 'SEO vs GEO: ¿Cuáles son las diferencias en 2025?',
    },
    description: {
      fr: 'Comprendre les différences fondamentales entre le référencement traditionnel (SEO) et l\'optimisation pour les moteurs génératifs (GEO).',
      en: 'Understand the fundamental differences between traditional SEO and Generative Engine Optimization (GEO).',
      es: 'Comprender las diferencias fundamentales entre el SEO tradicional y la optimización para motores generativos (GEO).',
    },
    heroImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    heroAlt: {
      fr: 'Comparaison visuelle entre SEO et GEO avec des graphiques et des données',
      en: 'Visual comparison between SEO and GEO with charts and data',
      es: 'Comparación visual entre SEO y GEO con gráficos y datos',
    },
    author: 'Adrien',
    date: '2025-01-28',
    summaryPoints: {
      fr: [
        'Les différences techniques entre SEO et GEO',
        'Comment les moteurs IA citent les sources',
        'Les stratégies pour optimiser les deux',
      ],
      en: [
        'Technical differences between SEO and GEO',
        'How AI engines cite sources',
        'Strategies to optimize for both',
      ],
      es: [
        'Diferencias técnicas entre SEO y GEO',
        'Cómo los motores IA citan las fuentes',
        'Estrategias para optimizar ambos',
      ],
    },
    sources: [
      { title: 'Google Search Central - SEO Starter Guide', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
      { title: 'OpenAI - ChatGPT Documentation', url: 'https://platform.openai.com/docs' },
    ],
  },
  // Ajoutez ici les 12 autres articles avec leurs données
];

// Fonction helper pour récupérer un article par son slug
export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return blogArticles.find((article) => article.slug === slug);
}
