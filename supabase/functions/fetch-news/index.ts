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

// Category-specific fallback images (10 per category for variety)
const CATEGORY_IMAGES: Record<string, string[]> = {
  SEO: [
    'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=450&fit=crop', // Analytics dashboard
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop', // Data charts
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop', // Marketing data
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop', // Dashboard screens
    'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=450&fit=crop', // Marketing strategy
    'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=800&h=450&fit=crop', // SEO concept
    'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=800&h=450&fit=crop', // Google search
    'https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=450&fit=crop', // Team analytics
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=450&fit=crop', // Growth charts
    'https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=800&h=450&fit=crop', // Digital marketing
  ],
  LLM: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop', // AI abstract
    'https://images.unsplash.com/photo-1676299081847-824916de030a?w=800&h=450&fit=crop', // ChatGPT style
    'https://images.unsplash.com/photo-1684369176170-463e84248b70?w=800&h=450&fit=crop', // AI brain
    'https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=800&h=450&fit=crop', // Neural network
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=450&fit=crop', // AI robot
    'https://images.unsplash.com/photo-1666597107756-ef489e9f1f09?w=800&h=450&fit=crop', // Machine learning
    'https://images.unsplash.com/photo-1673187402824-7502cae3e6fe?w=800&h=450&fit=crop', // AI chat
    'https://images.unsplash.com/photo-1694903089396-3aace4f52427?w=800&h=450&fit=crop', // Generative AI
    'https://images.unsplash.com/photo-1675271591211-126ad94e495d?w=800&h=450&fit=crop', // AI technology
    'https://images.unsplash.com/photo-1712002641088-9d76f9080889?w=800&h=450&fit=crop', // AI future
  ],
  GEO: [
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=450&fit=crop', // Robot
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&h=450&fit=crop', // Voice assistant
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&h=450&fit=crop', // AI assistant
    'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=800&h=450&fit=crop', // Smart device
    'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=800&h=450&fit=crop', // AI search
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=450&fit=crop', // AI overview
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=450&fit=crop', // Matrix data
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=450&fit=crop', // Tech network
    'https://images.unsplash.com/photo-1488229297570-58520851e868?w=800&h=450&fit=crop', // Data flow
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=450&fit=crop', // Circuit board
  ],
};

// Get random fallback image for a category
function getRandomFallbackImage(category: string): string {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['SEO'];
  return images[Math.floor(Math.random() * images.length)];
}

// Google News RSS feeds for different queries
const GOOGLE_NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=SEO+référencement&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=LLM+intelligence+artificielle&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=ChatGPT+search&hl=fr&gl=FR&ceid=FR:fr',
  'https://news.google.com/rss/search?q=Google+AI+search&hl=en&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=Perplexity+AI+search&hl=en&gl=US&ceid=US:en',
];

// Translate text using Lovable AI Gateway
async function translateText(text: string, targetLang: string): Promise<string> {
  // Skip translation if already in target language or if French (source language)
  if (targetLang === 'fr') return text;
  
  const langNames: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
  };
  
  const targetLangName = langNames[targetLang] || 'English';
  
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not found, skipping translation');
      return text;
    }
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${targetLangName}. Only return the translated text, nothing else. Keep any technical terms (SEO, LLM, GEO, ChatGPT, etc.) unchanged.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      console.log('Translation API error:', response.status);
      return text;
    }
    
    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    
    if (translated) {
      return translated;
    }
    
    return text;
  } catch (error) {
    console.log('Translation error:', error);
    return text;
  }
}

// Batch translate multiple texts
async function batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === 'fr') return texts;
  
  // Translate in parallel with concurrency limit
  const BATCH_SIZE = 5;
  const results: string[] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const translated = await Promise.all(batch.map(text => translateText(text, targetLang)));
    results.push(...translated);
  }
  
  return results;
}

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
      'capital.fr': 'Capital',
      'frandroid.com': 'Frandroid',
      'laprovence.com': 'La Provence',
      'vice.com': 'VICE',
      'macrumors.com': 'MacRumors',
      'bilan.ch': 'Bilan',
      'webrankinfo.com': 'WebRankInfo',
      'ouestmedias.com': 'Ouest Médias',
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

// Check if URL is a Google News redirect URL
function isGoogleNewsUrl(url: string): boolean {
  return url.includes('news.google.com/rss/articles/') || url.includes('news.google.com/articles/');
}

// Check if image URL is a Google placeholder
function isGooglePlaceholder(imageUrl: string | null): boolean {
  if (!imageUrl) return true;
  return imageUrl.includes('lh3.googleusercontent.com') || 
         imageUrl.includes('googleusercontent.com') ||
         imageUrl.includes('news.google.com');
}

// Follow redirects to get final URL
async function getActualUrl(googleNewsUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    // Follow redirects manually to get the final URL
    const response = await fetch(googleNewsUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    clearTimeout(timeout);
    
    // The response.url should be the final URL after redirects
    if (response.url && !isGoogleNewsUrl(response.url)) {
      console.log(`Resolved: ${googleNewsUrl.slice(0, 60)}... -> ${response.url.slice(0, 60)}...`);
      return response.url;
    }
    
    // Try to extract URL from the HTML content if redirect didn't work
    const html = await response.text();
    
    // Look for canonical link
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
                          html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
    if (canonicalMatch && canonicalMatch[1] && !isGoogleNewsUrl(canonicalMatch[1])) {
      return canonicalMatch[1];
    }
    
    // Look for og:url
    const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
    if (ogUrlMatch && ogUrlMatch[1] && !isGoogleNewsUrl(ogUrlMatch[1])) {
      return ogUrlMatch[1];
    }
    
    return googleNewsUrl;
  } catch (error) {
    console.log('Failed to resolve URL:', googleNewsUrl.slice(0, 50), error);
    return googleNewsUrl;
  }
}

// Fetch og:image from actual article URL
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract og:image (multiple patterns)
    const ogPatterns = [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /<meta[^>]*name=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    ];
    
    for (const pattern of ogPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const imageUrl = match[1];
        if (imageUrl.startsWith('http') && !isGooglePlaceholder(imageUrl)) {
          console.log(`Found og:image for ${url.slice(0, 40)}...`);
          return imageUrl;
        }
      }
    }
    
    // Fallback: twitter:image
    const twitterPatterns = [
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      /<meta[^>]*property=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    ];
    
    for (const pattern of twitterPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].startsWith('http') && !isGooglePlaceholder(match[1])) {
        console.log(`Found twitter:image for ${url.slice(0, 40)}...`);
        return match[1];
      }
    }
    
    // Last resort: look for large images in article
    const imgMatch = html.match(/<img[^>]*src=["']([^"']+(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*(?:width=["'][4-9]\d{2}|class=["'][^"']*(?:hero|featured|main|article)[^"']*)/i);
    if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
      return imgMatch[1];
    }
    
    return null;
  } catch (error) {
    console.log('Failed to fetch og:image for:', url.slice(0, 50));
    return null;
  }
}

async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
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

// Process a single article - resolve URL and fetch image
async function processArticle(item: RSSItem, score: number, index: number): Promise<ArticleResult> {
  const combinedText = `${item.title} ${item.description || ''}`;
  const category = detectCategory(combinedText);
  
  // Resolve actual URL if it's a Google News redirect
  let actualUrl = item.link;
  if (isGoogleNewsUrl(item.link)) {
    actualUrl = await getActualUrl(item.link);
  }
  
  const sourceInfo = extractSourceFromUrl(actualUrl);
  
  // Try to get image - first check if RSS thumbnail is valid (not Google placeholder)
  let imageUrl: string = '';
  
  const rssThumbnail = item.thumbnail || item.enclosure?.link;
  if (rssThumbnail && !isGooglePlaceholder(rssThumbnail)) {
    imageUrl = rssThumbnail;
  }
  
  // If no valid image from RSS, fetch og:image from actual article
  if (!imageUrl && !isGoogleNewsUrl(actualUrl)) {
    const ogImage = await fetchOgImage(actualUrl);
    if (ogImage) {
      imageUrl = ogImage;
    }
  }
  
  // Use category-specific random fallback if still no image
  if (!imageUrl) {
    imageUrl = getRandomFallbackImage(category);
  }
  
  const article: ArticleResult = {
    id: `news-${Date.now()}-${index}`,
    title: item.title,
    summary: item.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
    url: actualUrl,
    imageUrl,
    category,
    source: {
      id: `src-${sourceInfo.name.toLowerCase().replace(/\s/g, '-')}`,
      name: sourceInfo.name,
      url: sourceInfo.baseUrl,
      trustScore: 85,
      lastCrawled: new Date().toISOString(),
    },
    publishedAt: item.pubDate || new Date().toISOString(),
    relevanceScore: score,
    keywords: extractKeywords(combinedText),
  };
  
  return article;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for language parameter
    let lang = 'fr';
    try {
      const body = await req.json();
      lang = body.lang || 'fr';
    } catch {
      // No body or invalid JSON, use default
    }
    
    console.log(`Fetching news from Google News RSS feeds (lang: ${lang})...`);
    
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
    
    // Sort by score and take top 20
    articlesWithScore.sort((a, b) => b.score - a.score);
    const topArticles = articlesWithScore.slice(0, 20);
    
    // Process articles in batches with concurrency limit
    const CONCURRENT_REQUESTS = 3; // Lower concurrency to avoid rate limits
    const results: ArticleResult[] = [];
    
    for (let i = 0; i < topArticles.length; i += CONCURRENT_REQUESTS) {
      const batch = topArticles.slice(i, i + CONCURRENT_REQUESTS);
      
      const batchPromises = batch.map(({ item, score }, batchIndex) => 
        processArticle(item, score, i + batchIndex)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    // Translate titles and summaries if not French
    if (lang !== 'fr' && results.length > 0) {
      console.log(`Translating ${results.length} articles to ${lang}...`);
      
      // Extract all titles and summaries for batch translation
      const titles = results.map(a => a.title);
      const summaries = results.map(a => a.summary);
      
      // Translate in parallel
      const [translatedTitles, translatedSummaries] = await Promise.all([
        batchTranslate(titles, lang),
        batchTranslate(summaries, lang),
      ]);
      
      // Apply translations
      for (let i = 0; i < results.length; i++) {
        results[i].title = translatedTitles[i] || results[i].title;
        results[i].summary = translatedSummaries[i] || results[i].summary;
      }
      
      console.log(`Translation complete for ${lang}`);
    }
    
    console.log(`Returning ${results.length} processed articles with images`);
    
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
