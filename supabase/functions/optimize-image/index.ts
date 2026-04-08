import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

/**
 * optimize-image — Image proxy that converts to WebP/AVIF via wsrv.nl
 * 
 * Usage:
 *   GET ?url=https://example.com/photo.png&w=800&q=80&format=webp
 *   POST { url, width?, quality?, format? }
 * 
 * Premium mode: proxies through this edge function (caching headers)
 * Free mode: returns the wsrv.nl URL for client-side <picture> rewrite
 */

const ALLOWED_FORMATS = new Set(['webp', 'avif', 'jpg', 'png']);
const MAX_WIDTH = 2000;
const MAX_QUALITY = 100;
const DEFAULT_QUALITY = 80;
const DEFAULT_FORMAT = 'webp';

function buildWsrvUrl(imageUrl: string, opts: { width?: number; quality?: number; format?: string }): string {
  const params = new URLSearchParams();
  params.set('url', imageUrl);
  if (opts.width && opts.width > 0 && opts.width <= MAX_WIDTH) {
    params.set('w', String(opts.width));
  }
  params.set('q', String(Math.min(opts.quality || DEFAULT_QUALITY, MAX_QUALITY)));
  const fmt = ALLOWED_FORMATS.has(opts.format || '') ? opts.format! : DEFAULT_FORMAT;
  params.set('output', fmt);
  // Enable progressive loading
  params.set('il', '');
  return `https://wsrv.nl/?${params.toString()}`;
}

Deno.serve(handleRequest(async (req) => {
  try {
    let imageUrl: string;
    let width: number | undefined;
    let quality: number | undefined;
    let format: string | undefined;
    let proxy = false; // If true, proxy the bytes through this function

    if (req.method === 'GET') {
      const url = new URL(req.url);
      imageUrl = url.searchParams.get('url') || '';
      width = url.searchParams.get('w') ? parseInt(url.searchParams.get('w')!, 10) : undefined;
      quality = url.searchParams.get('q') ? parseInt(url.searchParams.get('q')!, 10) : undefined;
      format = url.searchParams.get('format') || undefined;
      proxy = url.searchParams.get('proxy') === '1';
    } else {
      const body = await req.json();
      imageUrl = body.url || '';
      width = body.width;
      quality = body.quality;
      format = body.format;
      proxy = body.proxy === true;
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'url parameter required' }), { status: 400, headers: HEADERS });
    }

    // Validate URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = 'https://' + imageUrl;
    }

    const wsrvUrl = buildWsrvUrl(imageUrl, { width, quality, format });

    // ── Mode 1: Return URL only (for client-side <picture> rewrite) ──
    if (!proxy) {
      return new Response(JSON.stringify({
        success: true,
        originalUrl: imageUrl,
        optimizedUrl: wsrvUrl,
        format: format || DEFAULT_FORMAT,
        width: width || null,
        quality: quality || DEFAULT_QUALITY,
      }), { headers: HEADERS });
    }

    // ── Mode 2: Proxy the image bytes (premium) ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(wsrvUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 Image Optimizer' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `wsrv.nl returned ${resp.status}` }), { status: 502, headers: HEADERS });
    }

    const contentType = resp.headers.get('content-type') || 'image/webp';
    const imageData = await resp.arrayBuffer();

    return new Response(imageData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Optimized-By': 'Crawlers.fr',
        'X-Original-Url': imageUrl,
      },
    });

  } catch (e) {
    console.error('[optimize-image]', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: HEADERS });
  }
}));
