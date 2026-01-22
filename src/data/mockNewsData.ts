import { NewsArticle, NewsSource, WhitelistState } from '@/types/news';

export const initialSources: NewsSource[] = [
  { id: 'src-1', name: 'Search Engine Journal', url: 'https://searchenginejournal.com', trustScore: 95, lastCrawled: new Date().toISOString() },
  { id: 'src-2', name: 'Moz Blog', url: 'https://moz.com/blog', trustScore: 92, lastCrawled: new Date().toISOString() },
  { id: 'src-3', name: 'Abondance', url: 'https://abondance.com', trustScore: 90, lastCrawled: new Date().toISOString() },
  { id: 'src-4', name: 'OpenAI Blog', url: 'https://openai.com/blog', trustScore: 98, lastCrawled: new Date().toISOString() },
  { id: 'src-5', name: 'Google AI Blog', url: 'https://ai.googleblog.com', trustScore: 97, lastCrawled: new Date().toISOString() },
  { id: 'src-6', name: 'Semrush Blog', url: 'https://semrush.com/blog', trustScore: 88, lastCrawled: new Date().toISOString() },
  { id: 'src-7', name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog', trustScore: 89, lastCrawled: new Date().toISOString() },
];

const MAX_ARTICLE_AGE_DAYS = 40;

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
  {
    id: 'art-6',
    title: 'Stratégie de contenu pour l\'ère de l\'IA : ce que les LLMs recherchent',
    summary: 'Les modèles de langage privilégient certains types de contenu. Apprenez à structurer vos pages pour maximiser les citations dans les réponses génératives.',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[5],
    publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 87,
    keywords: ['LLM', 'Contenu', 'SEO', 'Search', 'Stratégie']
  },
  {
    id: 'art-7',
    title: 'Données structurées et GEO : le guide complet du Schema.org pour l\'IA',
    summary: 'Les données structurées sont essentielles pour que les IA comprennent votre contenu. Guide pratique pour implémenter les schémas les plus efficaces.',
    imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[6],
    publishedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 91,
    keywords: ['GEO', 'Schema', 'SEO', 'Données structurées', 'Search']
  },
  {
    id: 'art-8',
    title: 'Perplexity, ChatGPT, Claude : comment chaque LLM indexe différemment le web',
    summary: 'Chaque moteur IA a ses propres critères de sélection. Analyse comparative des méthodes d\'indexation et recommandations pour optimiser votre visibilité sur chaque plateforme.',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=450&fit=crop',
    category: 'LLM',
    source: initialSources[0],
    publishedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 93,
    keywords: ['LLM', 'Perplexity', 'ChatGPT', 'Claude', 'Search']
  },
  {
    id: 'art-9',
    title: 'SEO technique 2025 : les fondamentaux qui comptent encore',
    summary: 'Malgré l\'essor de l\'IA, certains fondamentaux SEO restent incontournables. Tour d\'horizon des optimisations techniques toujours essentielles.',
    imageUrl: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=450&fit=crop',
    category: 'SEO',
    source: initialSources[1],
    publishedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 82,
    keywords: ['SEO', 'Technique', 'Fondamentaux', 'Optimisation']
  },
  {
    id: 'art-10',
    title: 'E-E-A-T et IA générative : renforcer votre autorité pour les moteurs du futur',
    summary: 'L\'expertise, l\'expérience et l\'autorité sont plus importantes que jamais. Comment construire une présence web que les IA recommanderont naturellement.',
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop',
    category: 'GEO',
    source: initialSources[4],
    publishedAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
    relevanceScore: 89,
    keywords: ['GEO', 'E-E-A-T', 'Autorité', 'SEO', 'Search']
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
