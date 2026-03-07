import crawlerHeroImage from '@/assets/blog/crawler-hero.webp';
import paradoxeGoogleGeoHero from '@/assets/blog/paradoxe-google-geo-hero.webp';

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
  // --- ARTICLE CRAWLER (NOUVEAU) ---
  {
    slug: 'crawler-definition-seo-geo',
    type: 'pillar',
    title: {
      fr: 'Un crawler c\'est quoi ? Tout comprendre de ce rouage essentiel pour le SEO et le GEO',
      en: 'What is a Crawler? Understanding This Essential Component for SEO and GEO',
      es: '¿Qué es un Crawler? Entender este engranaje esencial para SEO y GEO',
    },
    description: {
      fr: 'Découvrez ce qu\'est un crawler web : son histoire, son rôle crucial pour le SEO et le GEO, et pourquoi vous devez désormais parler aux robots avant vos clients.',
      en: 'Discover what a web crawler is: its history, crucial role for SEO and GEO, and why you must now speak to robots before your customers.',
      es: 'Descubre qué es un crawler web: su historia, papel crucial para SEO y GEO, y por qué debes hablar a los robots antes que a tus clientes.',
    },
    heroImage: crawlerHeroImage,
    heroAlt: {
      fr: 'Robot crawler futuriste explorant un réseau de données numériques',
      en: 'Futuristic crawler robot exploring a digital data network',
      es: 'Robot crawler futurista explorando una red de datos digitales',
    },
    author: 'Adrien',
    date: new Date().toISOString().split('T')[0],
    summaryPoints: {
      fr: [
        'Un crawler est un robot automatisé qui parcourt le web pour indexer les contenus.',
        'Sans crawlers, aucun moteur de recherche ni IA ne peut vous trouver.',
        'En 2026, les crawlers IA (GPTBot, ClaudeBot) sont aussi importants que Googlebot.',
        'Les crawlers "mangent" du HTML propre, du JSON-LD et des sitemaps frais.',
        'Parler aux robots avant vos clients est la nouvelle règle du marketing digital.',
      ],
      en: [
        'A crawler is an automated robot that traverses the web to index content.',
        'Without crawlers, no search engine or AI can find you.',
        'In 2026, AI crawlers (GPTBot, ClaudeBot) are as important as Googlebot.',
        'Crawlers "eat" clean HTML, JSON-LD, and fresh sitemaps.',
        'Speaking to robots before your customers is the new digital marketing rule.',
      ],
      es: [
        'Un crawler es un robot automatizado que recorre la web para indexar contenidos.',
        'Sin crawlers, ningún motor de búsqueda ni IA puede encontrarte.',
        'En 2026, los crawlers IA (GPTBot, ClaudeBot) son tan importantes como Googlebot.',
        'Los crawlers "comen" HTML limpio, JSON-LD y sitemaps frescos.',
        'Hablar a los robots antes que a tus clientes es la nueva regla del marketing digital.',
      ],
    },
    sources: [
      { title: 'Google Search Central - Googlebot', url: 'https://developers.google.com/search/docs/crawling-indexing/googlebot' },
      { title: 'OpenAI - GPTBot Documentation', url: 'https://platform.openai.com/docs/gptbot' },
      { title: 'W3C - Robots Exclusion Protocol', url: 'https://www.w3.org/TR/2022/WD-robots-20220606/' },
      { title: 'Anthropic - ClaudeBot', url: 'https://www.anthropic.com/' },
    ],
  },
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
      fr: 'Guide 2026 : Maîtriser GPTBot et les Crawlers IA',
      en: 'Guide 2026: Mastering GPTBot and AI Crawlers',
      es: 'Guía 2026: Dominar GPTBot y los Crawlers IA',
    },
    description: {
      fr: 'Guide complet : Comment configurer robots.txt pour GPTBot, ClaudeBot et Google-Extended. Avantages et risques pour votre SEO et GEO.',
      en: 'Complete guide: How to configure robots.txt for GPTBot, ClaudeBot and Google-Extended. Benefits and risks for your SEO and GEO.',
      es: 'Guía completa: Cómo configurar robots.txt para GPTBot, ClaudeBot y Google-Extended. Ventajas y riesgos para tu SEO y GEO.',
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
  {
    slug: 'google-sge-seo-preparation',
    type: 'satellite',
    title: {
      fr: 'Google SGE arrive : Pourquoi votre SEO actuel ne suffira plus',
      en: 'Google SGE is Coming: Why Your Current SEO Won\'t Be Enough',
      es: 'Google SGE llega: Por qué tu SEO actual no será suficiente',
    },
    description: {
      fr: 'La Search Generative Experience change les règles du jeu. Google ne vous envoie plus de trafic, il donne la réponse directement.',
      en: 'The Search Generative Experience changes the rules. Google no longer sends you traffic, it gives the answer directly.',
      es: 'La Search Generative Experience cambia las reglas. Google ya no te envía tráfico, da la respuesta directamente.',
    },
    heroImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
    heroAlt: {
      fr: 'Interface futuriste Google SGE',
      en: 'Futuristic Google SGE interface',
      es: 'Interfaz futurista de Google SGE',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'La fin des \'10 liens bleus\'.',
        'L\'importance des \'Featured Snippets\' sous stéroïdes.',
        'Comment gagner la position Zéro en 2026.',
      ],
      en: [
        'The end of the \'10 blue links\'.',
        'The importance of \'Featured Snippets\' on steroids.',
        'How to win position Zero in 2026.',
      ],
      es: [
        'El fin de los \'10 enlaces azules\'.',
        'La importancia de los \'Featured Snippets\' con esteroides.',
        'Cómo ganar la posición Cero en 2026.',
      ],
    },
    sources: [
      { title: 'Google The Keyword', url: 'https://blog.google/' },
      { title: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/' },
    ],
  },
  {
    slug: 'mission-mise-aux-normes-ia',
    type: 'satellite',
    title: {
      fr: 'Consultants : Comment vendre une mission \'Mise aux normes IA\' (GEO)',
      en: 'Consultants: How to Sell an \'AI Compliance\' (GEO) Mission',
      es: 'Consultores: Cómo vender una misión \'Cumplimiento IA\' (GEO)',
    },
    description: {
      fr: 'Ne vendez plus du vent. Vendez de la sécurité infrastructurelle. La mise aux normes IA est le service le plus facile à pitcher en 2026.',
      en: 'Stop selling smoke. Sell infrastructure security. AI compliance is the easiest service to pitch in 2026.',
      es: 'Deja de vender humo. Vende seguridad de infraestructura. El cumplimiento IA es el servicio más fácil de vender en 2026.',
    },
    heroImage: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
    heroAlt: {
      fr: 'Poignée de main business tech',
      en: 'Business tech handshake',
      es: 'Apretón de manos business tech',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Créer un sentiment d\'urgence légitime.',
        'Le pricing d\'un audit GEO.',
        'Fidéliser le client avec une veille mensuelle.',
      ],
      en: [
        'Create a legitimate sense of urgency.',
        'Pricing a GEO audit.',
        'Retain clients with monthly monitoring.',
      ],
      es: [
        'Crear un sentido de urgencia legítimo.',
        'El pricing de una auditoría GEO.',
        'Fidelizar al cliente con monitoreo mensual.',
      ],
    },
    sources: [
      { title: 'Forbes Agency Council', url: 'https://www.forbes.com/' },
      { title: 'Semrush Blog', url: 'https://www.semrush.com/blog/' },
    ],
  },
  {
    slug: 'json-ld-snippet-autorite',
    type: 'satellite',
    title: {
      fr: 'JSON-LD pour l\'IA : Le snippet de code qui fait de vous une autorité',
      en: 'JSON-LD for AI: The Code Snippet That Makes You an Authority',
      es: 'JSON-LD para IA: El snippet de código que te convierte en autoridad',
    },
    description: {
      fr: 'Les LLM ne \'lisent\' pas comme nous. Ils parsent de la donnée brute. Le JSON-LD est votre façon de leur dire qui vous êtes.',
      en: 'LLMs don\'t \'read\' like us. They parse raw data. JSON-LD is your way to tell them who you are.',
      es: 'Los LLM no \'leen\' como nosotros. Parsean datos brutos. JSON-LD es tu forma de decirles quién eres.',
    },
    heroImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80',
    heroAlt: {
      fr: 'Visualisation de données JSON',
      en: 'JSON data visualization',
      es: 'Visualización de datos JSON',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Pourquoi Schema.org est vital pour les LLM.',
        'Le schema \'Organization\' décortiqué.',
        'Exemple de code prêt à l\'emploi.',
      ],
      en: [
        'Why Schema.org is vital for LLMs.',
        'The \'Organization\' schema explained.',
        'Ready-to-use code example.',
      ],
      es: [
        'Por qué Schema.org es vital para los LLM.',
        'El esquema \'Organization\' explicado.',
        'Ejemplo de código listo para usar.',
      ],
    },
    sources: [
      { title: 'Schema.org', url: 'https://schema.org/' },
      { title: 'Google Search Gallery', url: 'https://developers.google.com/search/docs/appearance/structured-data/search-gallery' },
    ],
  },
  {
    slug: 'perplexity-seo-citation',
    type: 'satellite',
    title: {
      fr: 'Perplexity SEO : Comment devenir la source n°1 citée ?',
      en: 'Perplexity SEO: How to Become the #1 Cited Source?',
      es: 'Perplexity SEO: ¿Cómo convertirse en la fuente n°1 citada?',
    },
    description: {
      fr: 'Perplexity est devenu le moteur de recherche des décideurs tech et B2B. Être cité ici vaut 1000 visites Google non qualifiées.',
      en: 'Perplexity has become the search engine for tech and B2B decision-makers. Being cited here is worth 1000 unqualified Google visits.',
      es: 'Perplexity se ha convertido en el motor de búsqueda de decisores tech y B2B. Ser citado aquí vale 1000 visitas no cualificadas de Google.',
    },
    heroImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
    heroAlt: {
      fr: 'Interface Perplexity avec citations',
      en: 'Perplexity interface with citations',
      es: 'Interfaz de Perplexity con citas',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'L\'algorithme de citation de Perplexity analysé.',
        'L\'importance de la fraîcheur de l\'information.',
        'Structurer ses articles pour la citation.',
      ],
      en: [
        'Perplexity\'s citation algorithm analyzed.',
        'The importance of information freshness.',
        'Structuring articles for citation.',
      ],
      es: [
        'El algoritmo de citación de Perplexity analizado.',
        'La importancia de la frescura de la información.',
        'Estructurar artículos para la citación.',
      ],
    },
    sources: [
      { title: 'Perplexity AI FAQ', url: 'https://www.perplexity.ai/' },
      { title: 'Aravind Srinivas Twitter', url: 'https://twitter.com/AravSrinivas' },
    ],
  },
  {
    slug: 'audit-seo-gratuit-vs-semrush',
    type: 'satellite',
    title: {
      fr: 'Audit SEO Gratuit : Pourquoi les outils classiques (Semrush/Ahrefs) ratent l\'IA',
      en: 'Free SEO Audit: Why Classic Tools (Semrush/Ahrefs) Miss AI',
      es: 'Auditoría SEO Gratis: Por qué las herramientas clásicas (Semrush/Ahrefs) fallan con la IA',
    },
    description: {
      fr: 'Semrush et Ahrefs sont des outils fantastiques pour le web de 2020. Mais pour l\'ère des LLM, ils sont aveugles sur des points critiques.',
      en: 'Semrush and Ahrefs are fantastic tools for the 2020 web. But for the LLM era, they\'re blind to critical points.',
      es: 'Semrush y Ahrefs son herramientas fantásticas para la web de 2020. Pero para la era de los LLM, están ciegos a puntos críticos.',
    },
    heroImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
    heroAlt: {
      fr: 'Graphique comparatif d\'outils',
      en: 'Tools comparison chart',
      es: 'Gráfico comparativo de herramientas',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Ce que Semrush ne voit pas (le rendu LLM).',
        'Pourquoi le \'Keyword Volume\' est une métrique du passé.',
        'L\'avantage des outils natifs IA.',
      ],
      en: [
        'What Semrush doesn\'t see (LLM rendering).',
        'Why \'Keyword Volume\' is a past metric.',
        'The advantage of AI-native tools.',
      ],
      es: [
        'Lo que Semrush no ve (renderizado LLM).',
        'Por qué \'Keyword Volume\' es una métrica del pasado.',
        'La ventaja de herramientas nativas IA.',
      ],
    },
    sources: [
      { title: 'Ahrefs Blog', url: 'https://ahrefs.com/blog/' },
      { title: 'Moz Blog', url: 'https://moz.com/blog' },
    ],
  },
  {
    slug: 'tableau-comparatif-seo-geo-2026',
    type: 'satellite',
    title: {
      fr: 'SEO vs GEO : Le tableau comparatif définitif pour 2026',
      en: 'SEO vs GEO: The Definitive Comparison Table for 2026',
      es: 'SEO vs GEO: La tabla comparativa definitiva para 2026',
    },
    description: {
      fr: 'Vous êtes perdu entre les acronymes ? SEO, AEO, GEO, SGE... Ce guide visuel pose les bases définitives pour arbitrer vos budgets.',
      en: 'Lost between acronyms? SEO, AEO, GEO, SGE... This visual guide sets the definitive bases for budget decisions.',
      es: '¿Perdido entre acrónimos? SEO, AEO, GEO, SGE... Esta guía visual establece las bases definitivas para decidir presupuestos.',
    },
    heroImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    heroAlt: {
      fr: 'Tableau SEO vs GEO',
      en: 'SEO vs GEO table',
      es: 'Tabla SEO vs GEO',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Comparaison point par point (KPI, Objectifs, Méthodes).',
        'Budget : Faut-il investir en SEO ou GEO ?',
        'Les synergies entre les deux.',
      ],
      en: [
        'Point by point comparison (KPIs, Goals, Methods).',
        'Budget: Should you invest in SEO or GEO?',
        'Synergies between the two.',
      ],
      es: [
        'Comparación punto por punto (KPIs, Objetivos, Métodos).',
        'Presupuesto: ¿Invertir en SEO o GEO?',
        'Las sinergias entre ambos.',
      ],
    },
    sources: [
      { title: 'Gartner Predictions', url: 'https://www.gartner.com/' },
      { title: 'Search Engine Land', url: 'https://searchengineland.com/' },
    ],
  },
  {
    slug: 'liste-user-agents-ia-2026',
    type: 'satellite',
    title: {
      fr: 'La liste complète des User-Agents IA à surveiller (Mise à jour 2026)',
      en: 'Complete List of AI User-Agents to Monitor (2026 Update)',
      es: 'Lista completa de User-Agents IA a monitorear (Actualización 2026)',
    },
    description: {
      fr: 'Ne laissez pas des inconnus scraper votre site. Voici la liste tenue à jour des identifiants des robots d\'IA.',
      en: 'Don\'t let strangers scrape your site. Here\'s the updated list of AI robot identifiers.',
      es: 'No dejes que desconocidos scrapeen tu sitio. Aquí está la lista actualizada de identificadores de robots IA.',
    },
    heroImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80',
    heroAlt: {
      fr: 'Liste de bots style Matrix',
      en: 'Matrix style bot list',
      es: 'Lista de bots estilo Matrix',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Les bots majeurs (OpenAI, Anthropic, Google).',
        'Les bots \'Common Crawl\' (CCBot).',
        'Comment les identifier dans vos logs serveurs.',
      ],
      en: [
        'Major bots (OpenAI, Anthropic, Google).',
        'Common Crawl bots (CCBot).',
        'How to identify them in your server logs.',
      ],
      es: [
        'Los bots principales (OpenAI, Anthropic, Google).',
        'Los bots \'Common Crawl\' (CCBot).',
        'Cómo identificarlos en tus logs de servidor.',
      ],
    },
    sources: [
      { title: 'Dark Visitors', url: 'https://darkvisitors.com/' },
      { title: 'Cloudflare Bot Management', url: 'https://www.cloudflare.com/learning/bots/what-is-bot-management/' },
    ],
  },
  {
    slug: 'eeat-expertise-algorithme',
    type: 'satellite',
    title: {
      fr: 'E-E-A-T : Comment prouver votre expertise à un algorithme ?',
      en: 'E-E-A-T: How to Prove Your Expertise to an Algorithm?',
      es: 'E-E-A-T: ¿Cómo demostrar tu experiencia a un algoritmo?',
    },
    description: {
      fr: 'Pour Google et les IA, si vous n\'êtes pas un expert vérifié, vous êtes une \'hallucination potentielle\'. L\'E-E-A-T est une liste de critères techniques.',
      en: 'For Google and AI, if you\'re not a verified expert, you\'re a \'potential hallucination\'. E-E-A-T is a list of technical criteria.',
      es: 'Para Google y las IA, si no eres un experto verificado, eres una \'alucinación potencial\'. E-E-A-T es una lista de criterios técnicos.',
    },
    heroImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
    heroAlt: {
      fr: 'Certificat d\'expertise digital',
      en: 'Digital expertise certificate',
      es: 'Certificado de experiencia digital',
    },
    author: 'Adrien',
    date: today,
    summaryPoints: {
      fr: [
        'Définition de l\'Experience, Expertise, Authoritativeness, Trustworthiness.',
        'L\'importance des pages \'Auteur\'.',
        'Lier ses profils sociaux via le Schema.',
      ],
      en: [
        'Definition of Experience, Expertise, Authoritativeness, Trustworthiness.',
        'The importance of \'Author\' pages.',
        'Linking social profiles via Schema.',
      ],
      es: [
        'Definición de Experience, Expertise, Authoritativeness, Trustworthiness.',
        'La importancia de las páginas \'Autor\'.',
        'Vincular perfiles sociales via Schema.',
      ],
    },
    sources: [
      { title: 'Google Quality Rater Guidelines', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
      { title: 'Marie Haynes Consulting', url: 'https://www.mariehaynes.com/' },
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
