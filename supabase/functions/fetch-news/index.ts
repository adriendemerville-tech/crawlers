import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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
const TARGET_ARTICLE_COUNT = 15;
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

// Generate dynamic search feed URL based on user query
function buildSearchFeedUrl(searchTerm: string, lang: string = 'fr'): string {
  const encodedTerm = encodeURIComponent(searchTerm);
  const hl = lang === 'en' ? 'en' : 'fr';
  const gl = lang === 'en' ? 'US' : 'FR';
  const ceid = lang === 'en' ? 'US:en' : 'FR:fr';
  return `https://news.google.com/rss/search?q=${encodedTerm}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

// Fetch additional articles for a specific search term
async function fetchSupplementaryArticles(
  searchTerm: string, 
  lang: string, 
  existingUrls: Set<string>,
  neededCount: number,
  category: string
): Promise<ArticleResult[]> {
  console.log(`Fetching ${neededCount} supplementary articles for "${searchTerm}"...`);
  
  // Try multiple search variations
  const searchVariations = [
    searchTerm,
    `${searchTerm} AI`,
    `${searchTerm} technology`,
    `${searchTerm} actualités`,
  ];
  
  const allNewItems: RSSItem[] = [];
  
  for (const variation of searchVariations) {
    if (allNewItems.length >= neededCount * 2) break; // Get enough buffer
    
    const feedUrl = buildSearchFeedUrl(variation, lang);
    const items = await fetchRSSFeed(feedUrl);
    
    for (const item of items) {
      if (!existingUrls.has(item.link)) {
        existingUrls.add(item.link);
        allNewItems.push(item);
      }
    }
  }
  
  console.log(`Found ${allNewItems.length} new articles from supplementary search`);
  
  // Score and filter articles
  const articlesWithScore: Array<{ item: RSSItem; score: number }> = [];
  
  for (const item of allNewItems) {
    const combinedText = `${item.title} ${item.description || ''}`;
    const lowerCombined = combinedText.toLowerCase();
    
    // Boost score if contains search term, but don't exclude
    const containsSearch = lowerCombined.includes(searchTerm.toLowerCase());
    const baseScore = calculateRelevanceScore(combinedText);
    const adjustedScore = containsSearch ? baseScore + 20 : baseScore;
    
    // Apply category filter if provided
    if (category && category !== 'ALL') {
      const detectedCategory = detectCategory(combinedText);
      if (detectedCategory !== category) {
        continue;
      }
    }
    
    articlesWithScore.push({ item, score: adjustedScore });
  }
  
  // Sort by score and take what we need
  articlesWithScore.sort((a, b) => b.score - a.score);
  const topItems = articlesWithScore.slice(0, neededCount);
  
  // Process articles
  const CONCURRENT_REQUESTS = 3;
  const results: ArticleResult[] = [];
  
  for (let i = 0; i < topItems.length; i += CONCURRENT_REQUESTS) {
    const batch = topItems.slice(i, i + CONCURRENT_REQUESTS);
    const batchPromises = batch.map(({ item, score }, batchIndex) => 
      processArticle(item, score, 1000 + i + batchIndex) // Offset index to avoid conflicts
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// Batch translate multiple texts in a SINGLE LLM call (saves ~14 API calls per invocation)
async function batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
  if (!texts.length) return [];
  
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
      return texts;
    }

    // Build a numbered list for batch translation
    const numberedInput = texts.map((t, i) => `[${i}] ${t}`).join('\n');

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
            content: `You are a professional translator. Translate each numbered line to ${targetLangName}. If a line is already in ${targetLangName}, return it unchanged. Keep technical terms (SEO, LLM, GEO, ChatGPT, etc.) unchanged. Return ONLY the translated lines, one per line, keeping the [N] prefix. No extra text.`
          },
          {
            role: 'user',
            content: numberedInput
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.log('Batch translation API error:', response.status);
      return texts;
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content?.trim();

    if (!rawOutput) return texts;

    // Parse numbered output back into array
    const result = [...texts]; // clone as fallback
    const lines = rawOutput.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[(\d+)\]\s*(.+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx >= 0 && idx < texts.length) {
          result[idx] = match[2].trim();
        }
      }
    }

    return result;
  } catch (error) {
    console.log('Batch translation error:', error);
    return texts;
  }
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
  return url.includes('news.google.com');
}

// Check if image URL is a Google placeholder
function isGooglePlaceholder(imageUrl: string | null): boolean {
  if (!imageUrl) return true;
  return imageUrl.includes('lh3.googleusercontent.com') || 
         imageUrl.includes('googleusercontent.com') ||
         imageUrl.includes('news.google.com');
}

// Extract source name from title (Google News format: "Title - Source")
function extractSourceFromTitle(title: string): string | null {
  const match = title.match(/\s-\s([^-]+)$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Clean title by removing source suffix
function cleanTitle(title: string): string {
  return title.replace(/\s-\s[^-]+$/, '').trim();
}

// The Google News RSS URLs redirect properly when clicked by users
// We keep them as-is since decoding server-side is not reliable
// The redirect happens in the user's browser when they click the link

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
  
  // Google News RSS URLs redirect properly in browser - keep them as-is
  // The URL works when clicked by users (browser follows redirects)
  const actualUrl = item.link;
  
  // Extract source from title (format: "Title - Source Name")
  const sourceName = extractSourceFromTitle(item.title);
  const cleanedTitle = cleanTitle(item.title);
  
  // Try to get source info from URL (may not work for Google News URLs)
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
    title: cleanedTitle || item.title,
    summary: item.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
    url: actualUrl,
    imageUrl,
    category,
    source: {
      id: `src-${(sourceName || sourceInfo.name).toLowerCase().replace(/\s/g, '-')}`,
      name: sourceName || sourceInfo.name,
      url: sourceInfo.baseUrl || actualUrl,
      trustScore: 85,
      lastCrawled: new Date().toISOString(),
    },
    publishedAt: item.pubDate || new Date().toISOString(),
    relevanceScore: score,
    keywords: extractKeywords(combinedText),
  };
  
  return article;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for parameters
    let lang = 'fr';
    let searchQuery = '';
    let category = '';
    
    try {
      const body = await req.json();
      lang = body.lang || 'fr';
      searchQuery = (body.search || '').trim().toLowerCase();
      category = (body.category || '').toUpperCase();
    } catch {
      // No body or invalid JSON, use defaults
    }
    
    console.log(`Fetching news (lang: ${lang}, search: "${searchQuery}", category: "${category}")...`);
    
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
      const lowerCombined = combinedText.toLowerCase();
      
      // Apply search filter if provided
      if (searchQuery && !lowerCombined.includes(searchQuery)) {
        continue; // Skip articles that don't match search
      }
      
      // Apply category filter if provided
      if (category && category !== 'ALL') {
        const detectedCategory = detectCategory(combinedText);
        if (detectedCategory !== category) {
          continue; // Skip articles that don't match category
        }
      }
      
      const score = calculateRelevanceScore(combinedText);
      
      if (score >= MIN_RELEVANCE_SCORE) {
        articlesWithScore.push({ item, score });
      }
    }
    
    console.log(`${articlesWithScore.length} articles passed relevance filter (>= ${MIN_RELEVANCE_SCORE})`);
    
    // Sort by score and take top articles (target count)
    articlesWithScore.sort((a, b) => b.score - a.score);
    const topArticles = articlesWithScore.slice(0, TARGET_ARTICLE_COUNT);
    
    // Process articles in batches with concurrency limit
    const CONCURRENT_REQUESTS = 3; // Lower concurrency to avoid rate limits
    let results: ArticleResult[] = [];
    
    for (let i = 0; i < topArticles.length; i += CONCURRENT_REQUESTS) {
      const batch = topArticles.slice(i, i + CONCURRENT_REQUESTS);
      
      const batchPromises = batch.map(({ item, score }, batchIndex) => 
        processArticle(item, score, i + batchIndex)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    // If search query is provided and we don't have enough results, fetch supplementary articles
    const MIN_SEARCH_RESULTS = 5;
    if (searchQuery && results.length < Math.max(MIN_SEARCH_RESULTS, TARGET_ARTICLE_COUNT)) {
      const neededCount = Math.max(MIN_SEARCH_RESULTS, TARGET_ARTICLE_COUNT) - results.length;
      console.log(`Only ${results.length} articles found for "${searchQuery}", fetching ${neededCount} more...`);
      
      const supplementaryArticles = await fetchSupplementaryArticles(
        searchQuery,
        lang,
        seenUrls,
        neededCount,
        category
      );
      
      results = [...results, ...supplementaryArticles];
      console.log(`After supplementary fetch: ${results.length} total articles`);
    }
    
    // Translate titles and summaries to target language (RSS feeds may contain mixed languages)
    if (results.length > 0) {
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
}, 'fetch-news'))
