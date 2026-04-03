import { assertSafeUrl } from '../_shared/ssrf.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { fetchAndRenderPage } from '../_shared/renderPage.ts';
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { stealthFetch } from '../_shared/stealthFetch.ts';
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const AI_BOTS = [
  { name: 'GPTBot', userAgent: 'GPTBot', company: 'OpenAI' },
  { name: 'CCBot', userAgent: 'CCBot', company: 'Common Crawl' },
  { name: 'Google-Extended', userAgent: 'Google-Extended', company: 'Google (Gemini)' },
  { name: 'ClaudeBot', userAgent: 'ClaudeBot', company: 'Anthropic' },
  { name: 'Applebot-Extended', userAgent: 'Applebot-Extended', company: 'Apple Intelligence' },
  { name: 'PerplexityBot', userAgent: 'PerplexityBot', company: 'Perplexity AI' },
];

interface BotResult {
  name: string;
  userAgent: string;
  company: string;
  status: 'allowed' | 'blocked' | 'unknown';
  reason?: string;
  blockSource?: 'robots.txt' | 'meta-tag' | 'http-status';
  lineNumber?: number;
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function parseRobotsTxt(robotsTxt: string, botUserAgent: string): { allowed: boolean; lineNumber?: number; reason?: string } {
  const lines = robotsTxt.split('\n');
  let currentUserAgent = '';
  let isMatchingBot = false;
  let isWildcard = false;
  let wildcardDisallowed = false;
  let wildcardLine: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    const originalLine = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') continue;

    if (line.startsWith('user-agent:')) {
      const agent = originalLine.substring(11).trim();
      currentUserAgent = agent.toLowerCase();
      isMatchingBot = currentUserAgent === botUserAgent.toLowerCase();
      isWildcard = currentUserAgent === '*';
    } else if (line.startsWith('disallow:')) {
      const path = originalLine.substring(9).trim();
      
      // Check for specific bot block
      if (isMatchingBot && (path === '/' || path === '')) {
        if (path === '/') {
          return { 
            allowed: false, 
            lineNumber: i + 1, 
            reason: `Blocked by robots.txt rule: "Disallow: /"` 
          };
        }
      }
      
      // Track wildcard disallow
      if (isWildcard && path === '/') {
        wildcardDisallowed = true;
        wildcardLine = i + 1;
      }
    } else if (line.startsWith('allow:')) {
      const path = originalLine.substring(6).trim();
      
      // Check for specific bot allow
      if (isMatchingBot && (path === '/' || path === '')) {
        return { allowed: true };
      }
    }
  }

  // If no specific rule found, check wildcard
  if (wildcardDisallowed) {
    return { 
      allowed: false, 
      lineNumber: wildcardLine, 
      reason: `Blocked by wildcard rule: "User-agent: * Disallow: /"` 
    };
  }

  return { allowed: true };
}

function checkMetaRobots(html: string, botUserAgent: string): { allowed: boolean; reason?: string } {
  // Check for generic robots meta tag
  const metaRobotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  if (metaRobotsMatch) {
    const content = metaRobotsMatch[1].toLowerCase();
    if (content.includes('noindex') || content.includes('nofollow') || content.includes('none')) {
      return { 
        allowed: false, 
        reason: `Blocked by meta robots tag: "${metaRobotsMatch[1]}"` 
      };
    }
  }

  // Check for bot-specific meta tag
  const botMetaRegex = new RegExp(
    `<meta\\s+name=["']${botUserAgent}["']\\s+content=["']([^"']+)["']`,
    'i'
  );
  const botMetaMatch = html.match(botMetaRegex);
  if (botMetaMatch) {
    const content = botMetaMatch[1].toLowerCase();
    if (content.includes('noindex') || content.includes('nofollow') || content.includes('none')) {
      return { 
        allowed: false, 
        reason: `Blocked by ${botUserAgent} meta tag: "${botMetaMatch[1]}"` 
      };
    }
  }

  return { allowed: true };
}

Deno.serve(handleRequest(async (req) => {
try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    assertSafeUrl(normalizedUrl);
    const urlObj = new URL(normalizedUrl);
    const robotsTxtUrl = `${urlObj.origin}/robots.txt`;

    console.log('Checking URL:', normalizedUrl);
    console.log('Robots.txt URL:', robotsTxtUrl);

    // Fetch robots.txt
    let robotsTxt: string | null = null;
    try {
      const { response: robotsResponse } = await stealthFetch(robotsTxtUrl, {
        timeout: 8000,
        maxRetries: 1,
      });
      if (robotsResponse.ok) {
        robotsTxt = await robotsResponse.text();
        console.log('Robots.txt found, length:', robotsTxt.length);
      } else {
        console.log('Robots.txt not found:', robotsResponse.status);
      }
    } catch (e) {
      console.log('Failed to fetch robots.txt:', e);
    }

    // Fetch the actual page with JS rendering fallback for SPAs
    let pageHtml: string | null = null;
    let httpStatus = 200;
    let usedRendering = false;
    try {
      const renderResult = await fetchAndRenderPage(normalizedUrl, {
        userAgent: 'Mozilla/5.0 (compatible; AIBotChecker/1.0)',
        timeout: 10000,
      });
      pageHtml = renderResult.html;
      usedRendering = renderResult.usedRendering;
      console.log(`Page fetched, length: ${pageHtml.length}${usedRendering ? ' (JS rendered)' : ''}`);
    } catch (e) {
      console.log('Failed to fetch page:', e);
      // Try to get HTTP status from a simple HEAD request
      try {
        const headResponse = await fetch(normalizedUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIBotChecker/1.0)' },
          redirect: 'follow',
        });
        httpStatus = headResponse.status;
      } catch {
        httpStatus = 0;
      }
    }

    // Check each bot
    const bots: BotResult[] = AI_BOTS.map(bot => {
      let status: 'allowed' | 'blocked' | 'unknown' = 'allowed';
      let reason: string | undefined;
      let blockSource: 'robots.txt' | 'meta-tag' | 'http-status' | undefined;
      let lineNumber: number | undefined;

      // Check HTTP status first
      if (httpStatus === 401 || httpStatus === 403) {
        return {
          ...bot,
          status: 'blocked' as const,
          reason: `Blocked by HTTP status code: ${httpStatus}`,
          blockSource: 'http-status' as const
        };
      }

      // Check robots.txt
      if (robotsTxt) {
        const robotsResult = parseRobotsTxt(robotsTxt, bot.userAgent);
        if (!robotsResult.allowed) {
          return {
            ...bot,
            status: 'blocked' as const,
            reason: robotsResult.reason,
            blockSource: 'robots.txt' as const,
            lineNumber: robotsResult.lineNumber
          };
        }
      }

      // Check meta tags
      if (pageHtml) {
        const metaResult = checkMetaRobots(pageHtml, bot.userAgent);
        if (!metaResult.allowed) {
          return {
            ...bot,
            status: 'blocked' as const,
            reason: metaResult.reason,
            blockSource: 'meta-tag' as const
          };
        }
      }

      // If we couldn't fetch the page, status is unknown
      if (httpStatus === 0) {
        return {
          ...bot,
          status: 'unknown' as const,
          reason: 'Could not access the page to verify'
        };
      }

      return {
        ...bot,
        status: 'allowed' as const,
        reason: 'No blocking rules found'
      };
    });

    const result = {
      success: true,
      data: {
        url: normalizedUrl,
        httpStatus,
        robotsTxt: robotsTxt ? robotsTxt.substring(0, 2000) : null,
        metaRobots: pageHtml?.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] || null,
        bots,
        scannedAt: new Date().toISOString()
      }
    };

    // Fire-and-forget URL tracking + raw data capture
    trackAnalyzedUrl(normalizedUrl).catch(() => {});
    saveRawAuditData({
      url: normalizedUrl,
      domain: urlObj.hostname.replace(/^www\./, ''),
      auditType: 'lead_magnet_bots',
      rawPayload: { bots, httpStatus, hasRobotsTxt: !!robotsTxt },
      sourceFunctions: ['check-crawlers'],
    }).catch(() => {});

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check URL';
    await trackEdgeFunctionError('check-crawlers', errorMessage).catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));