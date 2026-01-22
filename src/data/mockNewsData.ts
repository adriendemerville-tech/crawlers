import { NewsArticle, NewsSource, WhitelistState } from '@/types/news';

// Sources diversifiées : presse nationale, internationale, spécialisée tech/marketing
export const initialSources: NewsSource[] = [
  // Presse nationale
  { id: 'src-1', name: 'Le Monde', url: 'https://lemonde.fr', trustScore: 96, lastCrawled: new Date().toISOString() },
  // Presse internationale
  { id: 'src-2', name: 'The Verge', url: 'https://theverge.com', trustScore: 94, lastCrawled: new Date().toISOString() },
  // Presse spécialisée tech/digital/marketing
  { id: 'src-3', name: 'L\'Usine Digitale', url: 'https://usine-digitale.fr', trustScore: 92, lastCrawled: new Date().toISOString() },
  { id: 'src-4', name: 'Journal du Net', url: 'https://journaldunet.com', trustScore: 90, lastCrawled: new Date().toISOString() },
  { id: 'src-5', name: 'Siècle Digital', url: 'https://siecledigital.fr', trustScore: 89, lastCrawled: new Date().toISOString() },
  { id: 'src-6', name: 'Maddyness', url: 'https://maddyness.com', trustScore: 88, lastCrawled: new Date().toISOString() },
  { id: 'src-7', name: 'L\'ADN', url: 'https://ladn.eu', trustScore: 87, lastCrawled: new Date().toISOString() },
  // Sources SEO/LLM spécialisées
  { id: 'src-8', name: 'Search Engine Journal', url: 'https://searchenginejournal.com', trustScore: 95, lastCrawled: new Date().toISOString() },
  { id: 'src-9', name: 'Abondance', url: 'https://abondance.com', trustScore: 91, lastCrawled: new Date().toISOString() },
  { id: 'src-10', name: 'ActuIA', url: 'https://actuia.com', trustScore: 88, lastCrawled: new Date().toISOString() },
];

const MAX_ARTICLE_AGE_DAYS = 40;

export const mockArticles: NewsArticle[] = [
  // Article presse nationale (Le Monde)
  {
    id: 'art-1',
    title: 'L\'intelligence artificielle bouleverse les métiers du référencement web',
    summary: 'Les professionnels du SEO doivent désormais composer avec ChatGPT et les moteurs génératifs. Une révolution qui redéfinit les stratégies de visibilité en ligne.',
    url: 'https://lemonde.fr/economie/article/intelligence-artificielle-seo',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[0], // Le Monde
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 94,
    keywords: ['GEO', 'LLM', 'SEO', 'Search', 'IA générative']
  },
  // Article presse internationale (The Verge)
  {
    id: 'art-2',
    title: 'Google\'s AI Overviews reshape how websites get discovered online',
    summary: 'The search giant\'s generative AI features are changing SEO forever. Publishers and marketers must adapt to a new era of AI-first search results.',
    url: 'https://theverge.com/2025/google-ai-overviews-seo-impact',
    imageUrl: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[1], // The Verge
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 93,
    keywords: ['GEO', 'Google', 'SGE', 'Search', 'SEO']
  },
  // Article L'Usine Digitale
  {
    id: 'art-3',
    title: 'Comment les entreprises françaises optimisent leur visibilité pour les LLM',
    summary: 'Face à l\'essor de ChatGPT et Perplexity, les marques tricolores repensent leur stratégie digitale. Le GEO devient un enjeu stratégique majeur.',
    url: 'https://usine-digitale.fr/article/visibilite-llm-entreprises-francaises',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[2], // L'Usine Digitale
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 91,
    keywords: ['LLM', 'GEO', 'SEO', 'Entreprises', 'Search']
  },
  // Article Journal du Net
  {
    id: 'art-4',
    title: 'Core Web Vitals 2025 : les nouvelles métriques à surveiller pour votre SEO',
    summary: 'Google renforce ses exigences de performance. INP, LCP et CLS deviennent incontournables pour maintenir son positionnement dans les résultats de recherche.',
    url: 'https://journaldunet.com/solutions/seo/core-web-vitals-2025',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    category: 'SEO',
    source: initialSources[3], // Journal du Net
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 88,
    keywords: ['SEO', 'Core Web Vitals', 'Performance', 'Google']
  },
  // Article Siècle Digital
  {
    id: 'art-5',
    title: 'RAG et Search : comment les architectures IA transforment la découverte de contenu',
    summary: 'Les systèmes de récupération augmentée redéfinissent l\'accès à l\'information. Implications pour les créateurs de contenu et les stratégies SEO.',
    url: 'https://siecledigital.fr/rag-search-ia-contenu',
    imageUrl: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[4], // Siècle Digital
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 90,
    keywords: ['RAG', 'LLM', 'SEO', 'IA', 'Search']
  },
  // Article Maddyness
  {
    id: 'art-6',
    title: 'Startups SEO : la nouvelle génération d\'outils pour l\'ère de l\'IA générative',
    summary: 'L\'écosystème startup français innove avec des solutions d\'analyse GEO. Tour d\'horizon des pépites qui réinventent le référencement.',
    url: 'https://maddyness.com/startups-seo-ia-generative',
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[5], // Maddyness
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 86,
    keywords: ['GEO', 'Startups', 'SEO', 'Outils', 'Innovation']
  },
  // Article L'ADN
  {
    id: 'art-7',
    title: 'Marketing digital : pourquoi le GEO devient prioritaire pour les marques',
    summary: 'Les directeurs marketing intègrent désormais la visibilité IA dans leurs KPIs. Une transformation profonde des stratégies de communication digitale.',
    url: 'https://ladn.eu/marketing-geo-priorite-marques',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[6], // L'ADN
    publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 85,
    keywords: ['GEO', 'Marketing', 'Marques', 'SEO', 'Search']
  },
  // Article Search Engine Journal
  {
    id: 'art-8',
    title: 'Perplexity, ChatGPT, Claude : optimiser son contenu pour chaque LLM',
    summary: 'Chaque moteur IA a ses propres critères de sélection. Guide comparatif des méthodes d\'indexation et recommandations d\'optimisation par plateforme.',
    url: 'https://searchenginejournal.com/optimize-content-llm-platforms',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[7], // Search Engine Journal
    publishedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 92,
    keywords: ['LLM', 'Perplexity', 'ChatGPT', 'Claude', 'Search']
  },
  // Article Abondance
  {
    id: 'art-9',
    title: 'E-E-A-T et moteurs génératifs : construire une autorité reconnue par l\'IA',
    summary: 'L\'expertise et l\'autorité restent des signaux clés pour les IA. Méthodologie pour développer une présence web naturellement recommandée par les LLM.',
    url: 'https://abondance.com/eeat-moteurs-generatifs-autorite-ia',
    imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[8], // Abondance
    publishedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 89,
    keywords: ['GEO', 'E-E-A-T', 'Autorité', 'SEO', 'Search']
  },
  // Article ActuIA
  {
    id: 'art-10',
    title: 'Les robots IA qui indexent le web : comment s\'y préparer techniquement',
    summary: 'GPTBot, ClaudeBot, PerplexityBot... Les crawlers IA se multiplient. Configuration robots.txt et bonnes pratiques pour accueillir ces nouveaux visiteurs.',
    url: 'https://actuia.com/robots-ia-indexent-web-preparation',
    imageUrl: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[9], // ActuIA
    publishedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 87,
    keywords: ['LLM', 'Crawlers', 'Robots', 'SEO', 'Technique']
  },
];

export const RELEVANCE_KEYWORDS = ['LLM', 'GEO', 'SEO', 'RAG', 'Search'];
export const MIN_RELEVANCE_SCORE = 70;
export const WHITELIST_STORAGE_KEY = 'crawlers_news_whitelist';

export function calculateRelevanceScore(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 50; // Base score
  
  RELEVANCE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 10;
    }
  });
  
  return Math.min(score, 100);
}

export function getWhitelistFromStorage(): WhitelistState {
  try {
    const stored = localStorage.getItem(WHITELIST_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading whitelist from storage:', e);
  }
  
  return {
    sources: initialSources,
    lastUpdated: new Date().toISOString()
  };
}

export function saveWhitelistToStorage(whitelist: WhitelistState): void {
  try {
    localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(whitelist));
  } catch (e) {
    console.error('Error saving whitelist to storage:', e);
  }
}

export function discoverNewSource(): NewsSource | null {
  const newSources: NewsSource[] = [
    { id: `src-new-${Date.now()}`, name: 'Backlinko', url: 'https://backlinko.com/blog', trustScore: 85, lastCrawled: new Date().toISOString() },
    { id: `src-new-${Date.now()}`, name: 'Anthropic Research', url: 'https://anthropic.com/research', trustScore: 94, lastCrawled: new Date().toISOString() },
    { id: `src-new-${Date.now()}`, name: 'The Keyword (Google)', url: 'https://blog.google', trustScore: 96, lastCrawled: new Date().toISOString() },
  ];
  
  // 30% chance to discover a new source
  if (Math.random() < 0.3) {
    return newSources[Math.floor(Math.random() * newSources.length)];
  }
  
  return null;
}

/**
 * Calculate article priority score
 * For lower relevance articles, trust score matters more than freshness
 */
function calculatePriorityScore(article: NewsArticle, sourceTrustScore: number): number {
  const now = Date.now();
  const articleAge = now - new Date(article.publishedAt).getTime();
  const ageDays = articleAge / (24 * 60 * 60 * 1000);
  
  // Freshness score: 100 for today, decreasing to 0 at MAX_ARTICLE_AGE_DAYS
  const freshnessScore = Math.max(0, 100 - (ageDays / MAX_ARTICLE_AGE_DAYS) * 100);
  
  // For high relevance articles (>= 85), balance freshness and trust
  // For lower relevance articles, prioritize trust score over freshness
  const relevanceThreshold = 85;
  
  if (article.relevanceScore >= relevanceThreshold) {
    // High relevance: 50% freshness, 30% trust, 20% relevance
    return freshnessScore * 0.5 + sourceTrustScore * 0.3 + article.relevanceScore * 0.2;
  } else {
    // Lower relevance: 20% freshness, 50% trust, 30% relevance
    return freshnessScore * 0.2 + sourceTrustScore * 0.5 + article.relevanceScore * 0.3;
  }
}

export async function fetchArticles(whitelist: WhitelistState): Promise<NewsArticle[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const now = Date.now();
  const maxAgeMs = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
  
  // Filter articles based on relevance score, source trust, and max age
  const filteredArticles = mockArticles.filter(article => {
    const source = whitelist.sources.find(s => s.id === article.source.id);
    const sourceTrustScore = source?.trustScore ?? article.source.trustScore;
    const articleAge = now - new Date(article.publishedAt).getTime();
    
    return (
      article.relevanceScore >= MIN_RELEVANCE_SCORE && 
      sourceTrustScore >= 70 &&
      articleAge <= maxAgeMs
    );
  });
  
  // Sort by priority score (trust more important for lower relevance articles)
  return filteredArticles.sort((a, b) => {
    const sourceA = whitelist.sources.find(s => s.id === a.source.id);
    const sourceB = whitelist.sources.find(s => s.id === b.source.id);
    const trustA = sourceA?.trustScore ?? a.source.trustScore;
    const trustB = sourceB?.trustScore ?? b.source.trustScore;
    
    const priorityA = calculatePriorityScore(a, trustA);
    const priorityB = calculatePriorityScore(b, trustB);
    
    return priorityB - priorityA;
  });
}
