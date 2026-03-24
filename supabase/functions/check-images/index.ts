import { corsHeaders } from '../_shared/cors.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    // ── Extract all img tags ──
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const totalImages = imgTags.length;

    let withAlt = 0;
    let withoutAlt = 0;
    let emptyAlt = 0;
    let withLazyLoading = 0;
    const formats: Record<string, number> = {};
    const missingAltSamples: string[] = [];

    for (const tag of imgTags) {
      // Alt attribute
      const altMatch = tag.match(/alt=["'](.*?)["']/i);
      if (!altMatch) {
        withoutAlt++;
        const src = tag.match(/src=["'](.*?)["']/i)?.[1];
        if (src && missingAltSamples.length < 5) missingAltSamples.push(src);
      } else if (altMatch[1].trim() === '') {
        emptyAlt++;
      } else {
        withAlt++;
      }

      // Lazy loading
      if (/loading=["']lazy["']/i.test(tag)) withLazyLoading++;

      // Format detection from src
      const src = tag.match(/src=["'](.*?)["']/i)?.[1] || '';
      const ext = src.match(/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?|$)/i)?.[1]?.toLowerCase();
      if (ext) {
        const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
        formats[normalizedExt] = (formats[normalizedExt] || 0) + 1;
      }
    }

    // Check for modern formats
    const hasWebp = (formats['webp'] || 0) > 0;
    const hasAvif = (formats['avif'] || 0) > 0;
    const modernFormatRatio = totalImages > 0
      ? ((formats['webp'] || 0) + (formats['avif'] || 0)) / totalImages
      : 0;

    // ── Check picture/source elements for responsive images ──
    const pictureCount = (html.match(/<picture[\s>]/gi) || []).length;
    const srcsetCount = (html.match(/srcset=/gi) || []).length;

    // ── Score ──
    let score = 100;
    const issues: string[] = [];

    if (totalImages === 0) {
      score -= 5; issues.push('No images found on page');
    } else {
      const altRate = withAlt / totalImages;
      if (withoutAlt > 0) {
        const penalty = Math.min(25, withoutAlt * 5);
        score -= penalty;
        issues.push(`${withoutAlt} image(s) missing alt attribute`);
      }
      if (emptyAlt > 3) {
        score -= 5;
        issues.push(`${emptyAlt} image(s) with empty alt`);
      }
      if (!hasWebp && !hasAvif && totalImages > 3) {
        score -= 10;
        issues.push('No modern image formats (WebP/AVIF) detected');
      }
      if (withLazyLoading === 0 && totalImages > 5) {
        score -= 5;
        issues.push('No lazy loading detected');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      score: Math.max(0, score),
      total: totalImages,
      withAlt,
      withoutAlt,
      emptyAlt,
      altRate: totalImages > 0 ? Math.round((withAlt / totalImages) * 100) : 100,
      lazyLoading: { count: withLazyLoading, rate: totalImages > 0 ? Math.round((withLazyLoading / totalImages) * 100) : 0 },
      formats,
      modernFormats: { webp: hasWebp, avif: hasAvif, ratio: Math.round(modernFormatRatio * 100) },
      responsive: { pictureElements: pictureCount, srcsetUsage: srcsetCount },
      missingAltSamples,
      issues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-images]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
});
