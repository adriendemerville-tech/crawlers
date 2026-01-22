const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoFactor {
  id: string;
  name: string;
  description: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'error';
  recommendation?: string;
  details?: string;
}

const AI_BOTS = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'PerplexityBot', 'CCBot', 'Applebot-Extended'];

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function checkAIBotsAllowed(robotsTxt: string | null): { allowed: number; total: number; blocked: string[] } {
  if (!robotsTxt) return { allowed: AI_BOTS.length, total: AI_BOTS.length, blocked: [] };
  
  const blocked: string[] = [];
  const lines = robotsTxt.toLowerCase().split('\n');
  
  for (const bot of AI_BOTS) {
    let currentAgent = '';
    let isBlocked = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('user-agent:')) {
        currentAgent = trimmed.substring(11).trim();
      } else if (trimmed.startsWith('disallow:') && trimmed.includes('/')) {
        if (currentAgent === bot.toLowerCase() || currentAgent === '*') {
          // Check if there's a specific allow for this bot later
          const botSection = robotsTxt.toLowerCase().includes(`user-agent: ${bot.toLowerCase()}`);
          if (currentAgent === '*' && !botSection) {
            isBlocked = true;
          } else if (currentAgent === bot.toLowerCase()) {
            isBlocked = true;
          }
        }
      } else if (trimmed.startsWith('allow:') && currentAgent === bot.toLowerCase()) {
        isBlocked = false;
      }
    }
    
    if (isBlocked) blocked.push(bot);
  }
  
  return { allowed: AI_BOTS.length - blocked.length, total: AI_BOTS.length, blocked };
}

function extractHeadContent(html: string): string {
  // Extract the <head> section specifically for more accurate parsing
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return headMatch ? headMatch[1] : html;
}

function analyzeCanonical(html: string): { hasCanonical: boolean; canonicalUrl?: string } {
  const headContent = extractHeadContent(html);
  
  // Multiple regex patterns to catch canonical in various formats
  const patterns = [
    // Standard: <link rel="canonical" href="...">
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i,
    // Reversed: <link href="..." rel="canonical">
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i,
    // With other attributes in between
    /<link[^>]*rel=["']canonical["'][^>]*>/i,
  ];
  
  for (const pattern of patterns) {
    const match = headContent.match(pattern);
    if (match) {
      // If we captured the URL, extract it; otherwise just confirm presence
      let canonicalUrl: string | undefined = match[1];
      
      // If no URL captured but tag found, try to extract href separately
      if (!canonicalUrl && match[0]) {
        const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1]) {
          canonicalUrl = hrefMatch[1];
        }
      }
      
      return { 
        hasCanonical: true, 
        canonicalUrl: canonicalUrl 
      };
    }
  }
  
  // Also check for HTTP header equivalent in meta
  const metaCanonical = headContent.match(/<meta[^>]*http-equiv=["']Link["'][^>]*content=["'][^"']*rel=["']?canonical["']?[^"']*["'][^>]*>/i);
  if (metaCanonical) {
    return { hasCanonical: true };
  }
  
  return { hasCanonical: false };
}

function analyzeMetaTags(html: string): { 
  hasDescription: boolean; 
  hasKeywords: boolean; 
  hasRobots: boolean;
  hasCanonical: boolean;
  canonicalUrl?: string;
  description?: string;
} {
  const headContent = extractHeadContent(html);
  
  // More flexible regex patterns that handle attributes in any order
  const descMatch = headContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                    headContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  const keywordsMatch = headContent.match(/<meta[^>]*name=["']keywords["'][^>]*>/i);
  const robotsMatch = headContent.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  
  // Use the dedicated canonical analyzer
  const canonicalResult = analyzeCanonical(html);
  
  return {
    hasDescription: !!descMatch && descMatch[1]?.length > 50,
    hasKeywords: !!keywordsMatch,
    hasRobots: !!robotsMatch,
    hasCanonical: canonicalResult.hasCanonical,
    canonicalUrl: canonicalResult.canonicalUrl,
    description: descMatch?.[1]
  };
}

function analyzeStructuredData(html: string): { hasJsonLd: boolean; types: string[] } {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  
  if (!jsonLdMatches) return { hasJsonLd: false, types: [] };
  
  const types: string[] = [];
  for (const match of jsonLdMatches) {
    // Extract all @type values
    const typeMatches = match.matchAll(/"@type"\s*:\s*"([^"]+)"/gi);
    for (const typeMatch of typeMatches) {
      if (typeMatch[1] && !types.includes(typeMatch[1])) {
        types.push(typeMatch[1]);
      }
    }
  }
  
  return { hasJsonLd: true, types };
}

function detectSPA(html: string): { isSPA: boolean; hasSSR: boolean; framework?: string } {
  // Check for common SPA patterns
  const hasReactRoot = /<div[^>]*id=["']root["'][^>]*>\s*<\/div>/i.test(html) ||
                       /<div[^>]*id=["']app["'][^>]*>\s*<\/div>/i.test(html) ||
                       /<div[^>]*id=["']__next["'][^>]*>\s*<\/div>/i.test(html);
  
  // Check for framework indicators
  const hasReact = html.includes('__REACT') || html.includes('react') || html.includes('_react');
  const hasVue = html.includes('__VUE') || html.includes('vue');
  const hasNext = html.includes('__NEXT_DATA__') || html.includes('_next');
  const hasNuxt = html.includes('__NUXT__');
  
  // Check for SSR indicators (content inside root div, Next.js data, etc.)
  const rootContentMatch = html.match(/<div[^>]*id=["'](?:root|app|__next)["'][^>]*>([\s\S]*?)<\/div>/i);
  const hasSSRContent = rootContentMatch && rootContentMatch[1].trim().length > 100;
  const hasNextData = html.includes('__NEXT_DATA__');
  const hasNuxtData = html.includes('__NUXT__');
  
  const hasSSR = hasSSRContent || hasNextData || hasNuxtData;
  
  let framework: string | undefined;
  if (hasNext) framework = 'Next.js';
  else if (hasNuxt) framework = 'Nuxt';
  else if (hasReact) framework = 'React';
  else if (hasVue) framework = 'Vue';
  
  return {
    isSPA: hasReactRoot && !hasSSR,
    hasSSR,
    framework
  };
}

function analyzeContent(html: string): {
  hasH1: boolean;
  headingsCount: number;
  imagesWithAlt: number;
  imagesTotal: number;
  wordCount: number;
  isSPA: boolean;
  hasSSR: boolean;
  framework?: string;
} {
  const spaInfo = detectSPA(html);
  
  // Match H1 tags (handle both <h1> and <h1 class="...">, etc.)
  const h1Match = html.match(/<h1[\s>]/gi);
  const headingsMatch = html.match(/<h[1-6][\s>]/gi);
  
  // Match images with more flexible pattern
  const imagesMatch = html.match(/<img[^>]+>/gi) || [];
  const imagesWithAltMatch = imagesMatch.filter(img => /alt=["'][^"']+["']/i.test(img));
  
  // Get text content from body, excluding scripts and styles
  let bodyContent = '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  const wordCount = bodyContent.split(' ').filter(w => w.length > 2).length;
  
  return {
    hasH1: !!h1Match && h1Match.length >= 1,
    headingsCount: headingsMatch?.length || 0,
    imagesWithAlt: imagesWithAltMatch.length,
    imagesTotal: imagesMatch.length,
    wordCount,
    ...spaInfo
  };
}

function analyzeOpenGraph(html: string): { hasOg: boolean; hasTwitter: boolean } {
  // More flexible matching for OG and Twitter tags
  const ogMatch = html.match(/<meta[^>]*property=["']og:[^"']+["'][^>]*>/i);
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>/i);
  
  return {
    hasOg: !!ogMatch,
    hasTwitter: !!twitterMatch
  };
}

function checkSitemap(robotsTxt: string | null): boolean {
  if (!robotsTxt) return false;
  return robotsTxt.toLowerCase().includes('sitemap:');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const robotsTxtUrl = `${urlObj.origin}/robots.txt`;

    console.log('Analyzing GEO for:', normalizedUrl);

    // Fetch robots.txt
    let robotsTxt: string | null = null;
    try {
      const robotsResponse = await fetch(robotsTxtUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GEOChecker/1.0)' }
      });
      if (robotsResponse.ok) {
        robotsTxt = await robotsResponse.text();
      }
    } catch (e) {
      console.log('Failed to fetch robots.txt:', e);
    }

    // Fetch the page
    let pageHtml = '';
    try {
      const pageResponse = await fetch(normalizedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GEOChecker/1.0)' },
        redirect: 'follow'
      });
      if (pageResponse.ok) {
        pageHtml = await pageResponse.text();
      }
    } catch (e) {
      console.log('Failed to fetch page:', e);
    }

    // Analyze all factors
    const aiBotsResult = checkAIBotsAllowed(robotsTxt);
    const metaResult = analyzeMetaTags(pageHtml);
    const structuredData = analyzeStructuredData(pageHtml);
    const contentResult = analyzeContent(pageHtml);
    const ogResult = analyzeOpenGraph(pageHtml);
    const hasSitemap = checkSitemap(robotsTxt);

    const factors: GeoFactor[] = [];

    // Factor 1: AI Bots Access (20 points)
    const aiBotScore = Math.round((aiBotsResult.allowed / aiBotsResult.total) * 20);
    factors.push({
      id: 'ai-bots',
      name: 'AI Crawlers Access',
      description: 'Major AI bots can access your content',
      score: aiBotScore,
      maxScore: 20,
      status: aiBotScore >= 18 ? 'good' : aiBotScore >= 10 ? 'warning' : 'error',
      recommendation: aiBotScore < 20 
        ? `Allow blocked bots in robots.txt: ${aiBotsResult.blocked.join(', ')}`
        : undefined,
      details: `${aiBotsResult.allowed}/${aiBotsResult.total} AI bots allowed`
    });

    // Factor 2: Meta Description (15 points)
    const metaDescScore = metaResult.hasDescription ? 15 : 0;
    factors.push({
      id: 'meta-description',
      name: 'Meta Description',
      description: 'Quality meta description for AI summaries',
      score: metaDescScore,
      maxScore: 15,
      status: metaDescScore === 15 ? 'good' : 'error',
      recommendation: !metaResult.hasDescription 
        ? 'Add a descriptive meta description (50-160 characters) that summarizes your page content'
        : undefined,
      details: metaResult.description 
        ? `"${metaResult.description.substring(0, 60)}..."` 
        : 'No meta description found'
    });

    // Factor 3: Structured Data (15 points)
    const structuredScore = structuredData.hasJsonLd ? 15 : 0;
    factors.push({
      id: 'structured-data',
      name: 'Structured Data (JSON-LD)',
      description: 'Schema.org markup for AI understanding',
      score: structuredScore,
      maxScore: 15,
      status: structuredScore === 15 ? 'good' : 'error',
      recommendation: !structuredData.hasJsonLd 
        ? 'Add JSON-LD structured data (Organization, Article, Product, FAQ, etc.) to help AI understand your content'
        : undefined,
      details: structuredData.hasJsonLd 
        ? `Found types: ${structuredData.types.join(', ')}` 
        : 'No structured data found'
    });

    // Factor 4: Content Structure (15 points)
    let contentScore = 0;
    const contentIssues: string[] = [];
    
    // If it's a client-side SPA without SSR, warn about it
    if (contentResult.isSPA && !contentResult.hasSSR) {
      contentIssues.push(`Detected ${contentResult.framework || 'SPA'} without SSR - AI crawlers may not see dynamic content. Consider using SSR/SSG`);
    }
    
    if (contentResult.hasH1) contentScore += 5;
    if (contentResult.headingsCount >= 3) contentScore += 5;
    if (contentResult.wordCount >= 300) contentScore += 5;
    
    if (!contentResult.hasH1) contentIssues.push('Add a single H1 heading');
    if (contentResult.headingsCount < 3) contentIssues.push('Use more heading hierarchy (H2, H3)');
    if (contentResult.wordCount < 300) {
      if (contentResult.isSPA && !contentResult.hasSSR) {
        contentIssues.push('Low word count detected - this may be due to client-side rendering');
      } else {
        contentIssues.push('Add more content (aim for 300+ words)');
      }
    }
    
    let contentDetails = `H1: ${contentResult.hasH1 ? '✓' : '✗'} | Headings: ${contentResult.headingsCount} | Words: ~${contentResult.wordCount}`;
    if (contentResult.framework) {
      contentDetails += ` | ${contentResult.framework}${contentResult.hasSSR ? ' (SSR)' : ' (CSR)'}`;
    }
    
    factors.push({
      id: 'content-structure',
      name: 'Content Structure',
      description: 'Clear headings and sufficient content',
      score: contentScore,
      maxScore: 15,
      status: contentScore >= 12 ? 'good' : contentScore >= 8 ? 'warning' : 'error',
      recommendation: contentIssues.length > 0 ? contentIssues.join('. ') : undefined,
      details: contentDetails
    });

    // Factor 5: Image Alt Text (10 points)
    const altScore = contentResult.imagesTotal === 0 
      ? 10 
      : Math.round((contentResult.imagesWithAlt / contentResult.imagesTotal) * 10);
    factors.push({
      id: 'image-alt',
      name: 'Image Alt Text',
      description: 'Descriptive alt text for images',
      score: altScore,
      maxScore: 10,
      status: altScore >= 8 ? 'good' : altScore >= 5 ? 'warning' : 'error',
      recommendation: altScore < 10 && contentResult.imagesTotal > 0
        ? `Add descriptive alt text to ${contentResult.imagesTotal - contentResult.imagesWithAlt} images`
        : undefined,
      details: contentResult.imagesTotal === 0 
        ? 'No images found' 
        : `${contentResult.imagesWithAlt}/${contentResult.imagesTotal} images have alt text`
    });

    // Factor 6: Open Graph (10 points)
    let ogScore = 0;
    if (ogResult.hasOg) ogScore += 5;
    if (ogResult.hasTwitter) ogScore += 5;
    
    factors.push({
      id: 'social-meta',
      name: 'Social Meta Tags',
      description: 'Open Graph and Twitter Cards',
      score: ogScore,
      maxScore: 10,
      status: ogScore >= 8 ? 'good' : ogScore >= 5 ? 'warning' : 'error',
      recommendation: ogScore < 10 
        ? `Add ${!ogResult.hasOg ? 'Open Graph tags' : ''}${!ogResult.hasOg && !ogResult.hasTwitter ? ' and ' : ''}${!ogResult.hasTwitter ? 'Twitter Card tags' : ''}`
        : undefined,
      details: `OG: ${ogResult.hasOg ? '✓' : '✗'} | Twitter: ${ogResult.hasTwitter ? '✓' : '✗'}`
    });

    // Factor 7: Sitemap (10 points)
    const sitemapScore = hasSitemap ? 10 : 0;
    factors.push({
      id: 'sitemap',
      name: 'XML Sitemap',
      description: 'Sitemap declared in robots.txt',
      score: sitemapScore,
      maxScore: 10,
      status: sitemapScore === 10 ? 'good' : 'error',
      recommendation: !hasSitemap 
        ? 'Add a Sitemap directive to your robots.txt file pointing to your XML sitemap'
        : undefined,
      details: hasSitemap ? 'Sitemap found in robots.txt' : 'No sitemap reference in robots.txt'
    });

    // Factor 8: Canonical URL (5 points)
    const canonicalScore = metaResult.hasCanonical ? 5 : 0;
    let canonicalDetails = 'No canonical tag found in <head>';
    if (metaResult.hasCanonical) {
      canonicalDetails = metaResult.canonicalUrl 
        ? `Canonical: ${metaResult.canonicalUrl.length > 50 ? metaResult.canonicalUrl.substring(0, 50) + '...' : metaResult.canonicalUrl}`
        : 'Canonical tag found';
    }
    
    factors.push({
      id: 'canonical',
      name: 'Canonical URL',
      description: 'Canonical tag to avoid duplicate content',
      score: canonicalScore,
      maxScore: 5,
      status: canonicalScore === 5 ? 'good' : 'warning',
      recommendation: !metaResult.hasCanonical 
        ? 'Add a <link rel="canonical" href="..."> tag in your <head> section to indicate the preferred version of this page'
        : undefined,
      details: canonicalDetails
    });

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: normalizedUrl,
          totalScore,
          factors,
          renderingInfo: {
            isSPA: contentResult.isSPA,
            hasSSR: contentResult.hasSSR,
            framework: contentResult.framework
          },
          scannedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze GEO';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
