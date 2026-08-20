import { memo, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { sanitizeHtmlDeterministic, PURIFY_CONFIG } from '@/lib/security/sanitizeHtml';
import { buildImageSrcSet, buildImageUrl } from '@/lib/blog/imageUrl';



interface HtmlContentRendererProps {
  html: string;
  className?: string;
}

/**
 * Optimise automatiquement les images Unsplash dans le HTML :
 * - Ajoute srcset responsive avec WebP auto-format
 * - Ajoute width/height pour éviter le CLS
 * - Première image : loading="eager" + fetchpriority="high" (LCP)
 * - Autres images : loading="lazy"
 */
function optimizeImages(html: string): string {
  let imageIndex = 0;
  
  return html.replace(
    /<img\s+([^>]*)>/gi,
    (match, attrs: string) => {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/);
      if (!srcMatch) return match;
      
      const src = srcMatch[1];
      const isFirst = imageIndex === 0;
      imageIndex++;
      
      const altMatch = attrs.match(/alt=["']([^"']*)["']/);
      const alt = altMatch ? altMatch[1] : '';
      
      const srcset = buildImageSrcSet(src, [
        { width: 640, quality: 75 },
        { width: 828, quality: 75 },
        { width: 1200, quality: 80 },
      ]);
      if (srcset) {
        const optimizedSrc = buildImageUrl(src, { width: 1200, quality: 80 });

        
        return `<img src="${optimizedSrc}" srcset="${srcset}" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px" alt="${alt}" width="1200" height="630" loading="${isFirst ? 'eager' : 'lazy'}"${isFirst ? ' fetchpriority="high"' : ''} decoding="async" class="w-full h-auto object-cover" style="aspect-ratio:1200/630">`;
      }
      
      const hasWidth = /width=/i.test(attrs);
      const hasHeight = /height=/i.test(attrs);
      const hasLoading = /loading=/i.test(attrs);
      
      let enhanced = match;
      if (!hasLoading) {
        enhanced = enhanced.replace('<img ', `<img loading="${isFirst ? 'eager' : 'lazy'}" `);
      }
      if (!hasWidth) {
        enhanced = enhanced.replace('<img ', '<img width="1200" ');
      }
      if (!hasHeight) {
        enhanced = enhanced.replace('<img ', '<img height="630" ');
      }
      if (isFirst && !/fetchpriority/i.test(attrs)) {
        enhanced = enhanced.replace('<img ', '<img fetchpriority="high" ');
      }
      
      return enhanced;
    }
  );
}

/**
 * Le H1 de la page est celui du gabarit (titre de l'article). Tout H1 présent
 * dans le corps stocké en base est rétrogradé en H2 pour garantir un seul H1
 * par page. Transformation purement textuelle : identique au serveur et au
 * client, donc sans divergence d'hydratation.
 */
function demoteBodyH1(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/gi, (_m, attrs: string | undefined) => `<h2${attrs ?? ''}>`)
    .replace(/<\/h1>/gi, '</h2>');
}

/**
 * Composant pour afficher du contenu HTML stocké en base de données.
 * Sanitisation isomorphe : nettoyage déterministe au rendu serveur ET au
 * premier rendu client (donc aucune divergence d'hydratation, et le HTML
 * servi aux robots contient bien le corps de l'article), puis passe
 * DOMPurify après hydratation en défense en profondeur.
 */
function HtmlContentRendererComponent({ html, className = '' }: HtmlContentRendererProps) {
  const [sanitizedHtml, setSanitizedHtml] = useState(() => sanitizeHtmlDeterministic(html));

  useEffect(() => {
    const base = sanitizeHtmlDeterministic(html);
    setSanitizedHtml(base);
    try {
      if (typeof DOMPurify?.sanitize === 'function') {
        setSanitizedHtml(DOMPurify.sanitize(html, PURIFY_CONFIG as unknown as Record<string, unknown>));
      }
    } catch {
      /* le nettoyage déterministe reste appliqué */
    }
  }, [html]);

  // Force links to open in new tab
  const linkedHtml = sanitizedHtml
    .replace(/<a\s+(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');


  // Optimize images
  const optimizedHtml = demoteBodyH1(optimizeImages(linkedHtml));

  return (
    <div 
      className={`html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: optimizedHtml }}
    />
  );
}

export const HtmlContentRenderer = memo(HtmlContentRendererComponent);
