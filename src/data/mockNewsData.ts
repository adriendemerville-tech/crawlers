import { NewsArticle, NewsSource, WhitelistState } from '@/types/news';
import { supabase } from '@/integrations/supabase/client';

// Sources de référence pour le scoring
export const initialSources: NewsSource[] = [
  { id: 'src-1', name: 'Le Monde', url: 'https://lemonde.fr', trustScore: 96, lastCrawled: new Date().toISOString() },
  { id: 'src-2', name: 'The Verge', url: 'https://theverge.com', trustScore: 94, lastCrawled: new Date().toISOString() },
  { id: 'src-3', name: "L'Usine Digitale", url: 'https://usine-digitale.fr', trustScore: 92, lastCrawled: new Date().toISOString() },
  { id: 'src-4', name: 'Journal du Net', url: 'https://journaldunet.com', trustScore: 90, lastCrawled: new Date().toISOString() },
  { id: 'src-5', name: 'Siècle Digital', url: 'https://siecledigital.fr', trustScore: 89, lastCrawled: new Date().toISOString() },
  { id: 'src-6', name: 'Maddyness', url: 'https://maddyness.com', trustScore: 88, lastCrawled: new Date().toISOString() },
  { id: 'src-7', name: "L'ADN", url: 'https://ladn.eu', trustScore: 87, lastCrawled: new Date().toISOString() },
  { id: 'src-8', name: 'Search Engine Journal', url: 'https://searchenginejournal.com', trustScore: 95, lastCrawled: new Date().toISOString() },
  { id: 'src-9', name: 'Abondance', url: 'https://abondance.com', trustScore: 91, lastCrawled: new Date().toISOString() },
  { id: 'src-10', name: 'ActuIA', url: 'https://actuia.com', trustScore: 88, lastCrawled: new Date().toISOString() },
];

const MAX_ARTICLE_AGE_DAYS = 40;

export const RELEVANCE_KEYWORDS = ['LLM', 'GEO', 'SEO', 'RAG', 'Search', 'AI', 'ChatGPT', 'Perplexity'];
export const MIN_RELEVANCE_SCORE = 70;
export const WHITELIST_STORAGE_KEY = 'crawlers_news_whitelist';

export function calculateRelevanceScore(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 50;
  
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
  // La découverte de nouvelles sources se fait maintenant via les articles RSS
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
  
  const freshnessScore = Math.max(0, 100 - (ageDays / MAX_ARTICLE_AGE_DAYS) * 100);
  const relevanceThreshold = 85;
  
  if (article.relevanceScore >= relevanceThreshold) {
    return freshnessScore * 0.5 + sourceTrustScore * 0.3 + article.relevanceScore * 0.2;
  } else {
    return freshnessScore * 0.2 + sourceTrustScore * 0.5 + article.relevanceScore * 0.3;
  }
}

// Cache pour éviter les appels API répétés
let cachedArticles: NewsArticle[] | null = null;
let cacheTimestamp: number = 0;
let cachedLanguage: string = '';
let cachedSearch: string = '';
let cachedCategory: string = '';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchArticles(
  whitelist: WhitelistState, 
  forceRefresh = false,
  lang = 'fr',
  search = '',
  category = ''
): Promise<NewsArticle[]> {
  const now = Date.now();
  
  // Retourner le cache si valide, pas de refresh forcé et mêmes paramètres
  const sameParams = cachedLanguage === lang && cachedSearch === search && cachedCategory === category;
  if (!forceRefresh && cachedArticles && (now - cacheTimestamp) < CACHE_DURATION && sameParams) {
    console.log('Returning cached articles');
    return cachedArticles;
  }
  
  try {
    console.log(`Fetching fresh news from edge function (lang: ${lang}, search: "${search}", category: "${category}")...`);
    
    const { data, error } = await supabase.functions.invoke('fetch-news', {
      body: { lang, search, category }
    });
    
    if (error) {
      console.error('Error calling fetch-news function:', error);
      throw error;
    }
    
    if (!data?.success || !data?.articles) {
      console.error('Invalid response from fetch-news:', data);
      throw new Error('Invalid response from news API');
    }
    
    const articles: NewsArticle[] = data.articles;
    
    // Appliquer le scoring de priorité basé sur la whitelist
    const maxAgeMs = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    const processedArticles = articles
      .filter(article => {
        const articleAge = now - new Date(article.publishedAt).getTime();
        return articleAge <= maxAgeMs;
      })
      .map(article => {
        // Chercher si la source existe dans la whitelist pour appliquer son trustScore
        const whitelistedSource = whitelist.sources.find(
          s => s.name.toLowerCase() === article.source.name.toLowerCase() ||
               article.source.url.includes(s.url.replace('https://', '').replace('http://', ''))
        );
        
        if (whitelistedSource) {
          return {
            ...article,
            source: {
              ...article.source,
              trustScore: whitelistedSource.trustScore
            }
          };
        }
        
        return article;
      })
      .sort((a, b) => {
        const priorityA = calculatePriorityScore(a, a.source.trustScore);
        const priorityB = calculatePriorityScore(b, b.source.trustScore);
        return priorityB - priorityA;
      });
    
    // Mettre à jour le cache
    cachedArticles = processedArticles;
    cacheTimestamp = now;
    cachedLanguage = lang;
    cachedSearch = search;
    cachedCategory = category;
    
    // Mettre à jour la whitelist avec les nouvelles sources découvertes
    const newSources: NewsSource[] = [];
    for (const article of processedArticles) {
      const exists = whitelist.sources.some(
        s => s.name.toLowerCase() === article.source.name.toLowerCase()
      );
      if (!exists && !newSources.some(s => s.name === article.source.name)) {
        newSources.push(article.source);
      }
    }
    
    if (newSources.length > 0) {
      const updatedWhitelist: WhitelistState = {
        sources: [...whitelist.sources, ...newSources],
        lastUpdated: new Date().toISOString()
      };
      saveWhitelistToStorage(updatedWhitelist);
    }
    
    console.log(`Returning ${processedArticles.length} articles`);
    return processedArticles;
    
  } catch (error) {
    console.error('Error fetching articles:', error);
    
    // Si on a un cache, le retourner même s'il est expiré
    if (cachedArticles) {
      console.log('Returning stale cache due to error');
      return cachedArticles;
    }
    
    // Sinon retourner un tableau vide
    return [];
  }
}

// Fonction pour forcer le refresh (utilisée par le bouton Actualiser)
export async function refreshArticles(
  whitelist: WhitelistState, 
  lang = 'fr',
  search = '',
  category = ''
): Promise<NewsArticle[]> {
  return fetchArticles(whitelist, true, lang, search, category);
}
