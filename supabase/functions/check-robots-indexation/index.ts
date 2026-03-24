import { corsHeaders } from '../_shared/cors.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'ClaudeBot', 'PerplexityBot', 'Applebot-Extended', 'anthropic-ai', 'CCBot', 'FacebookBot', 'Bytespider'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const baseUrl = url.startsWith('http') ? new URL(url).origin : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // ── Fetch robots.txt ──
    let robotsTxt: string | null = null;
    let robotsStatus = 0;
    try {
      const resp = await fetch(`${baseUrl}/robots.txt`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Crawlers.fr/1.0' },
      });
      robotsStatus = resp.status;
      if (resp.ok) robotsTxt = await resp.text();
      else await resp.text(); // consume body
    } catch { /* timeout or network error */ }
    clearTimeout(timeout);

    // ── Parse robots.txt directives ──
    const blockedBots: string[] = [];
    const allowedBots: string[] = [];
    let hasSitemapDirective = false;
    let sitemapUrls: string[] = [];

    if (robotsTxt) {
      const lines = robotsTxt.split('\n');
      let currentAgent = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed) continue;

        if (/^user-agent:\s*/i.test(trimmed)) {
          currentAgent = trimmed.replace(/^user-agent:\s*/i, '').trim();
        } else if (/^disallow:\s*\/\s*$/i.test(trimmed)) {
          // Full disallow
          if (currentAgent === '*') {
            blockedBots.push('ALL (via *)');
          } else {
            const matchedBot = AI_BOTS.find(b => b.toLowerCase() === currentAgent.toLowerCase());
            if (matchedBot) blockedBots.push(matchedBot);
          }
        } else if (/^allow:\s*/i.test(trimmed)) {
          const matchedBot = AI_BOTS.find(b => b.toLowerCase() === currentAgent.toLowerCase());
          if (matchedBot) allowedBots.push(matchedBot);
        } else if (/^sitemap:\s*/i.test(trimmed)) {
          hasSitemapDirective = true;
          sitemapUrls.push(trimmed.replace(/^sitemap:\s*/i, '').trim());
        }
      }

      // Check each AI bot specifically
      for (const bot of AI_BOTS) {
        const botSection = robotsTxt.match(new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, 'i'));
        if (botSection && /Disallow:\s*\/\s*$/m.test(botSection[0])) {
          if (!blockedBots.includes(bot)) blockedBots.push(bot);
        }
      }
    }

    // ── Fetch HTML for meta robots ──
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    let hasNoindex = false;
    let hasNofollow = false;
    let metaRobotsContent = '';

    try {
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 8000);
      const htmlResp = await fetch(targetUrl, {
        signal: ctrl2.signal,
        headers: { 'User-Agent': 'Crawlers.fr/1.0' },
      });
      clearTimeout(t2);
      const html = await htmlResp.text();

      const metaRobots = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["'](.*?)["']/i);
      if (metaRobots) {
        metaRobotsContent = metaRobots[1];
        hasNoindex = /noindex/i.test(metaRobotsContent);
        hasNofollow = /nofollow/i.test(metaRobotsContent);
      }

      // Check X-Robots-Tag in headers
      const xRobots = htmlResp.headers.get('x-robots-tag');
      if (xRobots) {
        if (/noindex/i.test(xRobots)) hasNoindex = true;
        if (/nofollow/i.test(xRobots)) hasNofollow = true;
      }
    } catch { /* ignore */ }

    // ── Check sitemap existence ──
    let sitemapExists = false;
    if (!hasSitemapDirective) {
      try {
        const sResp = await fetch(`${baseUrl}/sitemap.xml`, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Crawlers.fr/1.0' },
        });
        sitemapExists = sResp.ok;
        await sResp.text();
      } catch { /* ignore */ }
    } else {
      sitemapExists = true;
    }

    // ── Score ──
    let score = 100;
    const issues: string[] = [];

    if (robotsStatus === 404 || !robotsTxt) {
      score -= 10; issues.push('No robots.txt found');
    }
    if (blockedBots.length > 0) {
      score -= 5 * blockedBots.length;
      issues.push(`AI bots blocked: ${blockedBots.join(', ')}`);
    }
    if (hasNoindex) { score -= 25; issues.push('Page has noindex directive'); }
    if (hasNofollow) { score -= 10; issues.push('Page has nofollow directive'); }
    if (!sitemapExists && !hasSitemapDirective) { score -= 10; issues.push('No sitemap found'); }

    return new Response(JSON.stringify({
      success: true,
      score: Math.max(0, score),
      robotsTxt: {
        exists: !!robotsTxt,
        status: robotsStatus,
        content: robotsTxt?.slice(0, 2000) || null,
      },
      aiBots: { blocked: blockedBots, allowed: allowedBots },
      metaRobots: { content: metaRobotsContent, noindex: hasNoindex, nofollow: hasNofollow },
      sitemap: { exists: sitemapExists, urls: sitemapUrls },
      issues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-robots-indexation]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
});
