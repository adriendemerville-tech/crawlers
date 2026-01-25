const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  thumbnail?: string;
  enclosure?: { link?: string };
  source?: string;
}

interface RSS2JSONResponse {
  status: string;
  items: RSSItem[];
}

interface ArticleResult {
  id: string;
  title: string;
  summary: string;
  url: string;
  imageUrl: string;
  category: 'SEO' | 'LLM' | 'GEO';
  source: {
    id: string;
    name: string;
    url: string;
    trustScore: number;
    lastCrawled: string;
  };
  publishedAt: string;
  relevanceScore: number;
  keywords: string[];
}

const RELEVANCE_KEYWORDS = ['LLM', 'GEO', 'SEO', 'RAG', 'Search', 'AI', 'ChatGPT', 'Perplexity', 'Claude', 'Google', 'indexation', 'référencement', 'moteur'];
const MIN_RELEVANCE_SCORE = 70;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop';

// Google News RSS feeds for different queries
const GOOGLE_NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=SEO+référencement&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=LLM+intelligence+artificielle&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=ChatGPT+search&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=Google+AI+search&hl=en&gl=US&ceid=US:en',
];

function calculateRelevanceScore(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 50;
  
  RELEVANCE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 8;
    }
  });
  
  return Math.min(score, 100);
}

function detectCategory(text: string): 'SEO' | 'LLM' | 'GEO' {
  const lowerText = text.toLowerCase();
  
  const geoKeywords = ['geo', 'generative engine', 'ai overview', 'sge', 'perplexity', 'chatgpt search'];
  const llmKeywords = ['llm', 'chatgpt', 'claude', 'gpt', 'large language', 'ia générative', 'gemini', 'mistral'];
  const seoKeywords = ['seo', 'référencement', 'google search', 'ranking', 'backlink', 'core web vitals'];
  
  let geoScore = 0, llmScore = 0, seoScore = 0;
  
  geoKeywords.forEach(k => { if (lowerText.includes(k)) geoScore++; });
  llmKeywords.forEach(k => { if (lowerText.includes(k)) llmScore++; });
  seoKeywords.forEach(k => { if (lowerText.includes(k)) seoScore++; });
  
  if (geoScore >= llmScore && geoScore >= seoScore) return 'GEO';
  if (llmScore >= seoScore) return 'LLM';
  return 'SEO';
}

function extractKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return RELEVANCE_KEYWORDS.filter(k => lowerText.includes(k.toLowerCase()));
}

function extractSourceFromUrl(url: string): { name: string; baseUrl: string } {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.replace('www.', '');
    
    // Map common hostnames to friendly names
    const sourceMap: Record<string, string> = {
      'lemonde.fr': 'Le Monde',
      'lefigaro.fr': 'Le Figaro',
      'lesechos.fr': 'Les Échos',
      'bfmtv.com': 'BFM TV',
      'france24.com': 'France 24',
      'theverge.com': 'The Verge',
      'techcrunch.com': 'TechCrunch',
      'wired.com': 'Wired',
      'arstechnica.com': 'Ars Technica',
      'zdnet.com': 'ZDNet',
      'zdnet.fr': 'ZDNet France',
      'journaldunet.com': 'Journal du Net',
      'usine-digitale.fr': "L'Usine Digitale",
      'siecledigital.fr': 'Siècle Digital',
      'blogdumoderateur.com': 'Blog du Modérateur',
      'abondance.com': 'Abondance',
      'searchenginejournal.com': 'Search Engine Journal',
      'searchengineland.com': 'Search Engine Land',
      'moz.com': 'Moz',
      'semrush.com': 'Semrush',
      'anthropic.com': 'Anthropic',
      'openai.com': 'OpenAI',
      'blog.google': 'Google Blog',
    };
    
    const name = sourceMap[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
    
    return {
      name,
      baseUrl: `https://${hostname}`
    };
  } catch {
    return { name: 'Unknown', baseUrl: '' };
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    // Use a timeout for og:image fetching
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
    });
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      const imageUrl = ogImageMatch[1];
      // Validate it's a proper URL
      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }
    }
    
    // Fallback: try to find twitter:image
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    
    if (twitterImageMatch && twitterImageMatch[1] && twitterImageMatch[1].startsWith('http')) {
      return twitterImageMatch[1];
    }
    
    return null;
  } catch (error) {
    console.log('Failed to fetch og:image for:', url, error);
    return null;
  }
}

async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    // Use rss2json.com to convert RSS to JSON
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    
    const response = await fetch(rss2jsonUrl);
    
    if (!response.ok) {
      console.error('RSS2JSON error:', response.status);
      return [];
    }
    
    const data: RSS2JSONResponse = await response.json();
    
    if (data.status !== 'ok') {
      console.error('RSS2JSON status error');
      return [];
    }
    
    return data.items || [];
  } catch (error) {
    console.error('Error fetching RSS feed:', feedUrl, error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching news from Google News RSS feeds...');
    
    // Fetch all RSS feeds in parallel
    const feedPromises = GOOGLE_NEWS_FEEDS.map(feed => fetchRSSFeed(feed));
    const feedResults = await Promise.all(feedPromises);
    
    // Flatten and deduplicate by URL
    const allItems: RSSItem[] = [];
    const seenUrls = new Set<string>();
    
    for (const items of feedResults) {
      for (const item of items) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          allItems.push(item);
        }
      }
    }
    
    console.log(`Found ${allItems.length} unique articles from RSS feeds`);
    
    // Process articles and calculate relevance
    const articlesWithScore: Array<{ item: RSSItem; score: number }> = [];
    
    for (const item of allItems) {
      const combinedText = `${item.title} ${item.description || ''}`;
      const score = calculateRelevanceScore(combinedText);
      
      if (score >= MIN_RELEVANCE_SCORE) {
        articlesWithScore.push({ item, score });
      }
    }
    
    console.log(`${articlesWithScore.length} articles passed relevance filter (>= ${MIN_RELEVANCE_SCORE})`);
    
    // Sort by score and take top 15
    articlesWithScore.sort((a, b) => b.score - a.score);
    const topArticles = articlesWithScore.slice(0, 15);
    
    // Fetch og:images for top articles (in parallel with concurrency limit)
    const CONCURRENT_REQUESTS = 5;
    const results: ArticleResult[] = [];
    
    for (let i = 0; i < topArticles.length; i += CONCURRENT_REQUESTS) {
      const batch = topArticles.slice(i, i + CONCURRENT_REQUESTS);
      
      const batchPromises = batch.map(async ({ item, score }, batchIndex) => {
        const index = i + batchIndex;
        
        // Try to get image from RSS first, then og:image
        let imageUrl = item.thumbnail || item.enclosure?.link || null;
        
        if (!imageUrl) {
          imageUrl = await fetchOgImage(item.link);
        }
        
        const sourceInfo = extractSourceFromUrl(item.link);
        const combinedText = `${item.title} ${item.description || ''}`;
        
        const article: ArticleResult = {
          id: `news-${Date.now()}-${index}`,
          title: item.title,
          summary: item.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
          url: item.link,
          imageUrl: imageUrl || DEFAULT_IMAGE,
          category: detectCategory(combinedText),
          source: {
            id: `src-${sourceInfo.name.toLowerCase().replace(/\s/g, '-')}`,
            name: sourceInfo.name,
            url: sourceInfo.baseUrl,
            trustScore: 85, // Default trust score for discovered sources
            lastCrawled: new Date().toISOString(),
          },
          publishedAt: item.pubDate || new Date().toISOString(),
          relevanceScore: score,
          keywords: extractKeywords(combinedText),
        };
        
        return article;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    console.log(`Returning ${results.length} processed articles`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        articles: results,
        fetchedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in fetch-news function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        articles: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
