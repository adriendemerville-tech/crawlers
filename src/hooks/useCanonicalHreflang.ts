import { useEffect } from 'react';
import { useLocation } from '@/lib/router-compat';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE_URL = 'https://crawlers.fr';

/**
 * Canonicalizes every route to its FR version and enforces `noindex,nofollow`
 * on non-FR language variants (?lang=en, ?lang=es).
 *
 * Rationale: EN/ES variants have thin/duplicate content and dilute topical
 * authority. We concentrate crawl budget and signals on the FR version until
 * a real editorial plan exists for other languages.
 *
 * - Canonical always points to the FR URL (no ?lang= parameter).
 * - hreflang tags are removed entirely (single-language site for SEO).
 * - `<meta name="robots">` is set to `noindex,nofollow` when language !== 'fr'.
 */
export function useCanonicalHreflang(path?: string) {
  const { language } = useLanguage();
  const location = useLocation();

  const resolvedPath = path ?? location.pathname;

  useEffect(() => {
    const basePath = resolvedPath === '/' ? '' : resolvedPath;
    const canonicalUrl = `${SITE_URL}${basePath || '/'}`;

    // Canonical → always FR
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Purge every hreflang link (managed or static from index.html)
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());

    // Robots directive: noindex on non-FR variants
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    if (language !== 'fr') {
      robots.setAttribute('content', 'noindex,nofollow');
    } else {
      robots.setAttribute('content', 'index,follow');
    }

    return () => {
      // Reset robots to default on unmount so stale directive doesn't leak
      const r = document.querySelector('meta[name="robots"]');
      if (r) r.setAttribute('content', 'index,follow');
    };
  }, [language, resolvedPath]);
}
