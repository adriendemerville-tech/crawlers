import { NewsArticle, NewsSource, WhitelistState } from '@/types/news';

export const initialSources: NewsSource[] = [
  { id: 'src-1', name: 'Search Engine Journal', url: 'https://searchenginejournal.com', trustScore: 95, lastCrawled: new Date().toISOString() },
  { id: 'src-2', name: 'Moz Blog', url: 'https://moz.com/blog', trustScore: 92, lastCrawled: new Date().toISOString() },
  { id: 'src-3', name: 'Abondance', url: 'https://abondance.com', trustScore: 90, lastCrawled: new Date().toISOString() },
  { id: 'src-4', name: 'OpenAI Blog', url: 'https://openai.com/blog', trustScore: 98, lastCrawled: new Date().toISOString() },
  { id: 'src-5', name: 'Google AI Blog', url: 'https://ai.googleblog.com', trustScore: 97, lastCrawled: new Date().toISOString() },
];

export const mockArticles: NewsArticle[] = [
  {
    id: 'art-1',
    title: 'Comment optimiser votre site pour les moteurs de recherche génératifs (GEO)',
    summary: 'Les moteurs de recherche basés sur l\'IA changent la donne. Découvrez les meilleures pratiques pour adapter votre stratégie SEO aux nouvelles exigences des LLM et maximiser votre visibilité.',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[0],
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 95,
    keywords: ['GEO', 'LLM', 'SEO', 'Search', 'IA générative']
  },
  {
    id: 'art-2',
    title: 'Core Web Vitals 2025 : Les nouveaux critères SEO technique à maîtriser',
    summary: 'Google met à jour ses métriques de performance. INP remplace FID et de nouveaux signaux apparaissent. Voici comment préparer votre site pour ces changements majeurs.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    category: 'SEO',
    source: initialSources[1],
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 88,
    keywords: ['SEO', 'Core Web Vitals', 'Performance', 'Google']
  },
  {
    id: 'art-3',
    title: 'RAG et SEO : Comment les systèmes de récupération augmentée impactent le référencement',
    summary: 'Les architectures RAG transforment la façon dont les IA accèdent à l\'information. Comprenez leur fonctionnement pour optimiser votre contenu et apparaître dans les réponses générées.',
    imageUrl: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[3],
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 92,
    keywords: ['RAG', 'LLM', 'SEO', 'IA', 'Search']
  },
  {
    id: 'art-4',
    title: 'Google SGE : Analyse des premiers résultats et stratégies d\'adaptation',
    summary: 'La Search Generative Experience de Google redéfinit les SERPs. Notre analyse des tendances observées et les tactiques gagnantes pour maintenir votre trafic organique.',
    imageUrl: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[2],
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 90,
    keywords: ['GEO', 'Google', 'SGE', 'Search', 'SEO']
  },
  {
    id: 'art-5',
    title: 'Les meilleurs outils d\'analyse LLM pour auditer votre visibilité IA',
    summary: 'De nouveaux outils émergent pour mesurer comment les modèles de langage perçoivent votre marque. Comparatif des solutions les plus efficaces pour le monitoring GEO.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[4],
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 85,
    keywords: ['LLM', 'GEO', 'Outils', 'Analyse', 'Search']
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
    { id: `src-new-${Date.now()}`, name: 'Semrush Blog', url: 'https://semrush.com/blog', trustScore: 75, lastCrawled: new Date().toISOString() },
    { id: `src-new-${Date.now()}`, name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog', trustScore: 78, lastCrawled: new Date().toISOString() },
    { id: `src-new-${Date.now()}`, name: 'Anthropic Research', url: 'https://anthropic.com/research', trustScore: 80, lastCrawled: new Date().toISOString() },
  ];
  
  // 30% chance to discover a new source
  if (Math.random() < 0.3) {
    return newSources[Math.floor(Math.random() * newSources.length)];
  }
  
  return null;
}

export async function fetchArticles(whitelist: WhitelistState): Promise<NewsArticle[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Filter articles based on relevance score and source trust
  const filteredArticles = mockArticles.filter(article => {
    const source = whitelist.sources.find(s => s.id === article.source.id);
    const sourceTrustScore = source?.trustScore ?? article.source.trustScore;
    
    return article.relevanceScore >= MIN_RELEVANCE_SCORE && sourceTrustScore >= 70;
  });
  
  // Randomly shuffle to simulate "fresh" content
  return filteredArticles.sort(() => Math.random() - 0.5);
}
