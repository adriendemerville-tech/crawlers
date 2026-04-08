import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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

    interface ImageDetail {
      src: string;
      format: string | null;
      hasAlt: boolean;
      altText: string;
      hasLazy: boolean;
      hasDimensions: boolean;
      declaredWidth: number | null;
      declaredHeight: number | null;
      estimatedSizeKiB: number | null;
      issues: string[];
    }

    const imageDetails: ImageDetail[] = [];

    // ── Fetch image sizes in parallel (HEAD requests, max 10) ──
    const imgSources: { tag: string; src: string }[] = [];
    for (const tag of imgTags) {
      const srcMatch = tag.match(/src=["'](.*?)["']/i);
      if (srcMatch?.[1]) {
        let src = srcMatch[1];
        // Resolve relative URLs
        if (src.startsWith('/') && !src.startsWith('//')) {
          try {
            const u = new URL(targetUrl);
            src = `${u.protocol}//${u.host}${src}`;
          } catch {}
        } else if (src.startsWith('//')) {
          src = `https:${src}`;
        }
        imgSources.push({ tag, src });
      }
    }

    // HEAD requests for sizes (limit to first 20 images to avoid timeout)
    const sizeChecks = imgSources.slice(0, 20).map(async ({ tag, src }) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const headResp = await fetch(src, {
          method: 'HEAD',
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Crawlers.fr/1.0' },
          redirect: 'follow',
        });
        clearTimeout(t);
        const contentLength = headResp.headers.get('content-length');
        const contentType = headResp.headers.get('content-type');
        return {
          tag,
          src,
          sizeBytes: contentLength ? parseInt(contentLength, 10) : null,
          contentType: contentType || null,
        };
      } catch {
        return { tag, src, sizeBytes: null, contentType: null };
      }
    });

    const sizeResults = await Promise.allSettled(sizeChecks);
    const sizeMap = new Map<string, { sizeBytes: number | null; contentType: string | null }>();
    for (const r of sizeResults) {
      if (r.status === 'fulfilled' && r.value) {
        sizeMap.set(r.value.tag, { sizeBytes: r.value.sizeBytes, contentType: r.value.contentType });
      }
    }

    let totalImageSizeKiB = 0;
    let estimatedSavingsKiB = 0;
    let oversizedCount = 0;
    let missingDimensionsCount = 0;

    for (const tag of imgTags) {
      const issues: string[] = [];

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
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext || null;
      if (normalizedExt) {
        formats[normalizedExt] = (formats[normalizedExt] || 0) + 1;
      }

      // Dimensions
      const widthMatch = tag.match(/width=["']?(\d+)["']?/i);
      const heightMatch = tag.match(/height=["']?(\d+)["']?/i);
      const declaredWidth = widthMatch ? parseInt(widthMatch[1], 10) : null;
      const declaredHeight = heightMatch ? parseInt(heightMatch[1], 10) : null;
      const hasDimensions = declaredWidth !== null && declaredHeight !== null;

      if (!hasDimensions) {
        missingDimensionsCount++;
        issues.push('missing_dimensions');
      }

      // Size from HEAD
      const sizeInfo = sizeMap.get(tag);
      const sizeBytes = sizeInfo?.sizeBytes || null;
      const sizeKiB = sizeBytes ? Math.round(sizeBytes / 1024) : null;

      if (sizeKiB) totalImageSizeKiB += sizeKiB;

      // Estimate savings from format conversion
      if (sizeKiB && normalizedExt && ['png', 'jpg', 'bmp', 'gif'].includes(normalizedExt)) {
        // WebP typically saves 25-35% over JPEG, 60-80% over PNG
        const savingsRate = normalizedExt === 'png' ? 0.70 : normalizedExt === 'bmp' ? 0.85 : 0.30;
        estimatedSavingsKiB += Math.round(sizeKiB * savingsRate);
        issues.push(`convert_to_webp (save ~${Math.round(sizeKiB * savingsRate)} KiB)`);
      }

      // Oversized check: if declared dimensions are very large
      if (declaredWidth && declaredWidth > 2000) {
        oversizedCount++;
        issues.push(`oversized_width: ${declaredWidth}px`);
      }

      // Alt issues
      if (!altMatch) issues.push('missing_alt');
      else if (altMatch[1].trim() === '') issues.push('empty_alt');

      // Lazy loading
      if (!/loading=["']lazy["']/i.test(tag)) issues.push('no_lazy_loading');

      imageDetails.push({
        src: src.substring(0, 200), // truncate long URLs
        format: normalizedExt,
        hasAlt: !!altMatch && altMatch[1].trim() !== '',
        altText: (altMatch?.[1] || '').substring(0, 100),
        hasLazy: /loading=["']lazy["']/i.test(tag),
        hasDimensions,
        declaredWidth,
        declaredHeight,
        estimatedSizeKiB: sizeKiB,
        issues,
      });
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
    const recommendations: { id: string; title: string; description: string; impact: string; category: string }[] = [];

    if (totalImages === 0) {
      score -= 5;
      issues.push('No images found on page');
    } else {
      const altRate = withAlt / totalImages;
      if (withoutAlt > 0) {
        const penalty = Math.min(25, withoutAlt * 5);
        score -= penalty;
        issues.push(`${withoutAlt} image(s) missing alt attribute`);
        recommendations.push({
          id: 'missing-alt',
          title: 'Ajouter des attributs alt aux images',
          description: `${withoutAlt} image(s) n'ont pas d'attribut alt. Cela nuit à l'accessibilité et au SEO.`,
          impact: 'high',
          category: 'accessibility',
        });
      }
      if (emptyAlt > 3) {
        score -= 5;
        issues.push(`${emptyAlt} image(s) with empty alt`);
      }
      if (!hasWebp && !hasAvif && totalImages > 3) {
        score -= 10;
        issues.push('No modern image formats (WebP/AVIF) detected');
        recommendations.push({
          id: 'modern-formats',
          title: 'Utiliser des formats d\'image modernes (WebP/AVIF)',
          description: `Aucune image en format WebP ou AVIF détectée. La conversion peut réduire la taille de ~${estimatedSavingsKiB} KiB (${Math.round(estimatedSavingsKiB / 1024 * 10) / 10} MiB).`,
          impact: 'high',
          category: 'performance',
        });
      }
      if (withLazyLoading === 0 && totalImages > 5) {
        score -= 5;
        issues.push('No lazy loading detected');
        recommendations.push({
          id: 'lazy-loading',
          title: 'Ajouter le lazy loading aux images below-the-fold',
          description: `Aucun attribut loading="lazy" détecté sur ${totalImages} images. Les images en dessous de la ligne de flottaison devraient être chargées en différé.`,
          impact: 'medium',
          category: 'performance',
        });
      }
      if (missingDimensionsCount > 0) {
        score -= Math.min(10, missingDimensionsCount * 2);
        issues.push(`${missingDimensionsCount} image(s) without explicit width/height (causes CLS)`);
        recommendations.push({
          id: 'missing-dimensions',
          title: 'Ajouter width et height explicites aux images',
          description: `${missingDimensionsCount} image(s) sans dimensions explicites. Cela provoque des décalages de mise en page (CLS).`,
          impact: 'medium',
          category: 'performance',
        });
      }
      if (totalImageSizeKiB > 1000) {
        score -= Math.min(15, Math.round((totalImageSizeKiB - 1000) / 200));
        issues.push(`Total image weight: ${totalImageSizeKiB} KiB (${Math.round(totalImageSizeKiB / 1024 * 10) / 10} MiB)`);
        recommendations.push({
          id: 'image-weight',
          title: 'Réduire le poids total des images',
          description: `Poids total : ${totalImageSizeKiB} KiB. Cible recommandée : < 500 KiB par page. Compressez et redimensionnez les images.`,
          impact: 'high',
          category: 'performance',
        });
      }
      if (oversizedCount > 0) {
        score -= Math.min(10, oversizedCount * 3);
        issues.push(`${oversizedCount} image(s) with width > 2000px (likely oversized)`);
        recommendations.push({
          id: 'oversized-images',
          title: 'Redimensionner les images surdimensionnées',
          description: `${oversizedCount} image(s) avec largeur > 2000px. Servez des images à la taille d'affichage réelle pour réduire les temps de chargement.`,
          impact: 'high',
          category: 'performance',
        });
      }
      if (pictureCount === 0 && totalImages > 3) {
        recommendations.push({
          id: 'responsive-images',
          title: 'Utiliser <picture> et srcset pour le responsive',
          description: `Aucun élément <picture> détecté. Utilisez srcset pour servir des tailles adaptées au viewport (mobile, tablette, desktop).`,
          impact: 'medium',
          category: 'performance',
        });
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
      // New: sizes & savings
      totalImageSizeKiB,
      estimatedSavingsKiB,
      oversizedCount,
      missingDimensionsCount,
      // New: per-image details (top 20)
      imageDetails: imageDetails.slice(0, 20),
      // New: recommendations for Code Architect
      recommendations,
      missingAltSamples,
      issues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-images]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
}));
