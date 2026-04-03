import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 SEO Audit Bot' },
    });
    clearTimeout(timeout);

    const html = await resp.text();
    const lower = html.toLowerCase();

    // ── Title ──
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim().replace(/\s+/g, ' ') || null;
    const titleLength = title?.length || 0;

    // ── Meta description ──
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
    const metaDescription = metaDescMatch?.[1]?.trim() || null;
    const metaDescLength = metaDescription?.length || 0;

    // ── Canonical ──
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["'][^>]*>/i);
    const canonical = canonicalMatch?.[1] || null;

    // ── H1 ──
    const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    const h1s = h1Matches.map(m => m.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
    const h1Count = h1s.length;

    // ── H2-H6 counts ──
    const h2Count = (lower.match(/<h2[\s>]/g) || []).length;
    const h3Count = (lower.match(/<h3[\s>]/g) || []).length;
    const h4Count = (lower.match(/<h4[\s>]/g) || []).length;
    const h5Count = (lower.match(/<h5[\s>]/g) || []).length;
    const h6Count = (lower.match(/<h6[\s>]/g) || []).length;

    // ── Open Graph ──
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i);
    const ogTypeMatch = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["'](.*?)["']/i);
    const hasOg = !!(ogTitleMatch || ogDescMatch || ogImageMatch);

    // ── Viewport ──
    const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);

    // ── Hreflang ──
    const hreflangMatches = html.match(/<link[^>]*hreflang=["'][^"']*["'][^>]*>/gi) || [];

    // ── Scoring ──
    let score = 100;
    const issues: string[] = [];

    if (!title) { score -= 15; issues.push('Missing title tag'); }
    else if (titleLength < 30) { score -= 8; issues.push(`Title too short (${titleLength} chars)`); }
    else if (titleLength > 60) { score -= 5; issues.push(`Title too long (${titleLength} chars)`); }

    if (!metaDescription) { score -= 15; issues.push('Missing meta description'); }
    else if (metaDescLength < 120) { score -= 5; issues.push(`Meta desc too short (${metaDescLength} chars)`); }
    else if (metaDescLength > 160) { score -= 3; issues.push(`Meta desc too long (${metaDescLength} chars)`); }

    if (h1Count === 0) { score -= 15; issues.push('Missing H1'); }
    else if (h1Count > 1) { score -= 8; issues.push(`Multiple H1s (${h1Count})`); }

    if (!canonical) { score -= 5; issues.push('Missing canonical'); }
    if (!hasOg) { score -= 8; issues.push('Missing Open Graph tags'); }
    if (!hasViewport) { score -= 10; issues.push('Missing viewport meta'); }

    return new Response(JSON.stringify({
      success: true,
      score: Math.max(0, score),
      title, titleLength,
      metaDescription, metaDescLength,
      canonical,
      h1s, h1Count,
      h2Count, h3Count, h4Count, h5Count, h6Count,
      openGraph: {
        title: ogTitleMatch?.[1] || null,
        description: ogDescMatch?.[1] || null,
        image: ogImageMatch?.[1] || null,
        type: ogTypeMatch?.[1] || null,
        present: hasOg,
      },
      hasViewport,
      hreflangCount: hreflangMatches.length,
      issues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-meta-tags]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
}));