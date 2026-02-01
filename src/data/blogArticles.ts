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
  type?: 'pillar' | 'satellite';
}

// Today's date for all articles
const today = new Date().toISOString().split('T')[0];

export const blogArticles: BlogArticle[] = [
  // --- LES 3 PAGES PILIERS ---
  {
    slug: 'guide-visibilite-technique-ia',
    type: 'pillar',
    title: {
      fr: 'Le Guide Ultime de la Visibilité Technique : Robots.txt, JSON-LD et Sitemaps pour 2026',
      en: 'The Ultimate Guide to Technical Visibility: Robots.txt, JSON-LD and Sitemaps for 2026',
      es: 'La Guía Definitiva de Visibilidad Técnica: Robots.txt, JSON-LD y Sitemaps para 2026',
    },
    description: {
      fr: 'En 2026, avoir un site rapide ne suffit plus. Si votre infrastructure technique n\'est pas lisible par les bots d\'IA, vous n\'existez pas. Ce guide couvre les 3 piliers de l\'infrastructure GEO indispensable.',
      en: 'In 2026, having a fast site is no longer enough. If your technical infrastructure is not readable by AI bots, you don\'t exist. This guide covers the 3 pillars of essential GEO infrastructure.',
      es: 'En 2026, tener un sitio rápido ya no es suficiente. Si su infraestructura técnica no es legible por los bots de IA, no existe. Esta guía cubre los 3 pilares de la infraestructura GEO esencial.',
    },
    heroImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80',
    heroAlt: {
      fr: 'Schéma technique d\'un crawler analysant du code JSON-LD',
      en: 'Technical diagram of a crawler analyzing JSON-LD code',
      es: 'Diagrama técnico de un crawler analizando código JSON-LD',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Pourquoi votre robots.txt bloque peut-être vos meilleures opportunités.',
        'Le JSON-LD : la langue maternelle des LLM expliquée.',
        'Comment structurer un sitemap pour une indexation instantanée.',
      ],
      en: [
        'Why your robots.txt might be blocking your best opportunities.',
        'JSON-LD: the native language of LLMs explained.',
        'How to structure a sitemap for instant indexing.',
      ],
      es: [
        'Por qué tu robots.txt podría estar bloqueando tus mejores oportunidades.',
        'JSON-LD: el idioma nativo de los LLM explicado.',
        'Cómo estructurar un sitemap para indexación instantánea.',
      ],
    },
    sources: [
      { title: 'Google Search Central (Robots.txt)', url: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro' },
      { title: 'Schema.org (Doc Officielle)', url: 'https://schema.org/' },
    ],
  },
  {
    slug: 'comprendre-geo-vs-seo',
    type: 'pillar',
    title: {
      fr: 'Comprendre et Dompter le GEO (Generative Engine Optimization) : La fin du mot-clé',
      en: 'Understanding and Mastering GEO (Generative Engine Optimization): The End of Keywords',
      es: 'Comprender y Dominar el GEO (Generative Engine Optimization): El Fin de las Palabras Clave',
    },
    description: {
      fr: 'Le SEO consistait à être trouvé. Le GEO consiste à être cité. Découvrez le changement de paradigme le plus violent de l\'histoire du web et comment en tirer profit sans budget publicitaire.',
      en: 'SEO was about being found. GEO is about being cited. Discover the most violent paradigm shift in web history and how to profit from it without an advertising budget.',
      es: 'El SEO consistía en ser encontrado. El GEO consiste en ser citado. Descubre el cambio de paradigma más violento de la historia web y cómo aprovecharlo sin presupuesto publicitario.',
    },
    heroImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    heroAlt: {
      fr: 'Comparaison visuelle entre SEO et GEO avec des graphiques',
      en: 'Visual comparison between SEO and GEO with charts',
      es: 'Comparación visual entre SEO y GEO con gráficos',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'La différence fondamentale entre classer des liens et générer des réponses.',
        'Pourquoi l\'autorité sémantique remplace le volume de recherche.',
        'Comment adapter votre stratégie de contenu dès aujourd\'hui.',
      ],
      en: [
        'The fundamental difference between ranking links and generating responses.',
        'Why semantic authority replaces search volume.',
        'How to adapt your content strategy today.',
      ],
      es: [
        'La diferencia fundamental entre clasificar enlaces y generar respuestas.',
        'Por qué la autoridad semántica reemplaza el volumen de búsqueda.',
        'Cómo adaptar tu estrategia de contenido hoy.',
      ],
    },
    sources: [
      { title: 'Search Engine Land (SGE)', url: 'https://searchengineland.com/' },
      { title: 'Bing Webmaster Blog', url: 'https://blogs.bing.com/webmaster' },
    ],
  },
  {
    slug: 'vendre-audit-ia-clients',
    type: 'pillar',
    title: {
      fr: 'Consultants & Agences : Comment auditer et vendre la conformité IA à vos clients',
      en: 'Consultants & Agencies: How to Audit and Sell AI Compliance to Your Clients',
      es: 'Consultores y Agencias: Cómo Auditar y Vender la Conformidad IA a sus Clientes',
    },
    description: {
      fr: 'Vos clients entendent parler de l\'IA partout. Soyez celui qui sécurise leur avenir numérique. Voici la feuille de route précise pour intégrer l\'offre "Visibilité IA" à votre catalogue de services dès demain.',
      en: 'Your clients hear about AI everywhere. Be the one who secures their digital future. Here\'s the precise roadmap to integrate the "AI Visibility" offer into your service catalog tomorrow.',
      es: 'Sus clientes escuchan sobre IA en todas partes. Sea quien asegure su futuro digital. Aquí está la hoja de ruta precisa para integrar la oferta "Visibilidad IA" a su catálogo de servicios mañana.',
    },
    heroImage: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=80',
    heroAlt: {
      fr: 'Consultant présentant un audit SEO sur tablette',
      en: 'Consultant presenting an SEO audit on tablet',
      es: 'Consultor presentando una auditoría SEO en tableta',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'L\'argumentaire imparable pour vendre une mission de mise aux normes IA.',
        'Les livrables attendus pour un audit GEO.',
        'Comment utiliser l\'automatisation pour augmenter vos marges.',
      ],
      en: [
        'The unbeatable argument to sell an AI compliance mission.',
        'The expected deliverables for a GEO audit.',
        'How to use automation to increase your margins.',
      ],
      es: [
        'El argumento imbatible para vender una misión de cumplimiento IA.',
        'Los entregables esperados para una auditoría GEO.',
        'Cómo usar la automatización para aumentar tus márgenes.',
      ],
    },
    sources: [
      { title: 'McKinsey Digital (GenAI)', url: 'https://www.mckinsey.com/capabilities/mckinsey-digital' },
      { title: 'HubSpot Marketing Blog', url: 'https://blog.hubspot.com/marketing' },
    ],
  },
  // --- LES PAGES SATELLITES ---
  {
    slug: 'bloquer-autoriser-gptbot',
    type: 'satellite',
    title: {
      fr: 'Faut-il bloquer ou autoriser GPTBot ? Le guide de survie du robots.txt',
      en: 'Should You Block or Allow GPTBot? The robots.txt Survival Guide',
      es: '¿Bloquear o Permitir GPTBot? La Guía de Supervivencia del robots.txt',
    },
    description: {
      fr: 'C\'est la question que tout le monde se pose. Bloquer OpenAI pour protéger son contenu, ou ouvrir les vannes pour gagner en visibilité ? La réponse est nuancée, mais penche vers l\'ouverture.',
      en: 'It\'s the question everyone is asking. Block OpenAI to protect your content, or open the floodgates to gain visibility? The answer is nuanced, but leans towards openness.',
      es: 'Es la pregunta que todos se hacen. ¿Bloquear OpenAI para proteger tu contenido, o abrir las compuertas para ganar visibilidad? La respuesta es matizada, pero se inclina hacia la apertura.',
    },
    heroImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80',
    heroAlt: {
      fr: 'Code informatique montrant des User-Agents',
      en: 'Computer code showing User-Agents',
      es: 'Código informático mostrando User-Agents',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Différence entre GPTBot (scraping) et ChatGPT-User (navigation).',
        'Les risques de bloquer l\'IA.',
        'Le code exact à copier-coller.',
      ],
      en: [
        'Difference between GPTBot (scraping) and ChatGPT-User (browsing).',
        'The risks of blocking AI.',
        'The exact code to copy-paste.',
      ],
      es: [
        'Diferencia entre GPTBot (scraping) y ChatGPT-User (navegación).',
        'Los riesgos de bloquear la IA.',
        'El código exacto para copiar-pegar.',
      ],
    },
    sources: [
      { title: 'OpenAI Documentation', url: 'https://platform.openai.com/docs/gptbot' },
      { title: 'W3C Robots Standard', url: 'https://www.w3.org/TR/html4/wrapper/bots.html' },
    ],
  },
  {
    slug: 'site-invisible-chatgpt-solutions',
    type: 'satellite',
    title: {
      fr: 'Mon site est invisible sur ChatGPT : 3 erreurs techniques fatales',
      en: 'My Site is Invisible on ChatGPT: 3 Fatal Technical Errors',
      es: 'Mi Sitio es Invisible en ChatGPT: 3 Errores Técnicos Fatales',
    },
    description: {
      fr: 'Vous avez du contenu de qualité, mais ChatGPT affirme ne rien savoir sur vous ? C\'est probablement une barrière technique invisible qui empêche les bots de lire votre HTML. Voici comment la lever.',
      en: 'You have quality content, but ChatGPT claims to know nothing about you? It\'s probably an invisible technical barrier preventing bots from reading your HTML. Here\'s how to remove it.',
      es: '¿Tienes contenido de calidad, pero ChatGPT afirma no saber nada de ti? Probablemente sea una barrera técnica invisible que impide a los bots leer tu HTML. Aquí está cómo eliminarla.',
    },
    heroImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80',
    heroAlt: {
      fr: 'Loupe analysant du code pour débugger',
      en: 'Magnifying glass analyzing code for debugging',
      es: 'Lupa analizando código para depurar',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Le piège du JavaScript non rendu.',
        'Les problèmes de Sitemap.',
        'L\'impact du temps de chargement sur le crawl budget IA.',
      ],
      en: [
        'The trap of unrendered JavaScript.',
        'Sitemap problems.',
        'The impact of loading time on AI crawl budget.',
      ],
      es: [
        'La trampa del JavaScript no renderizado.',
        'Los problemas de Sitemap.',
        'El impacto del tiempo de carga en el presupuesto de rastreo IA.',
      ],
    },
    sources: [
      { title: 'Google Developers (JS SEO)', url: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics' },
      { title: 'Web.dev Performance', url: 'https://web.dev/performance/' },
    ],
  },
];

// Fonction helper pour récupérer un article par son slug
export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return blogArticles.find((article) => article.slug === slug);
}

// Fonction helper pour récupérer les articles par type
export function getArticlesByType(type: 'pillar' | 'satellite'): BlogArticle[] {
  return blogArticles.filter((article) => article.type === type);
}
