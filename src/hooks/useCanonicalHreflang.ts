import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE_URL = 'https://crawlers.fr';

/**
 * Dynamically manages canonical and hreflang tags based on the current language.
 * Each language variant gets its own canonical URL so Google indexes EN/ES pages
 * instead of treating them as duplicates of the FR version.
 *
 * @param path - The path without query params, e.g. '/' or '/audit-expert'
 */
export function useCanonicalHreflang(path: string = '/') {
  const { language } = useLanguage();

  useEffect(() => {
    const basePath = path === '/' ? '' : path;
    
    // Strip any ?tab= or other non-lang query params — only ?lang= is canonical
    const canonicalUrl = language === 'fr'
      ? `${SITE_URL}${basePath || '/'}`
      : `${SITE_URL}${basePath || '/'}?lang=${language}`;

    // Update canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Build hreflang URLs
    const hreflangMap: Record<string, string> = {
      fr: `${SITE_URL}${basePath || '/'}`,
      en: `${SITE_URL}${basePath || '/'}?lang=en`,
      es: `${SITE_URL}${basePath || '/'}?lang=es`,
    };

    // Remove existing hreflang links (managed by this hook)
    document.querySelectorAll('link[data-hreflang-managed]').forEach(el => el.remove());

    // Also remove the static hreflang links from index.html to avoid duplicates
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => {
      if (!el.hasAttribute('data-hreflang-managed')) {
        el.remove();
      }
    });

    // Inject new hreflang tags
    const langs = ['fr', 'en', 'es'];
    langs.forEach(lang => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', hreflangMap[lang]);
      link.setAttribute('data-hreflang-managed', 'true');
      document.head.appendChild(link);
    });

    // x-default points to FR version
    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', hreflangMap.fr);
    xDefault.setAttribute('data-hreflang-managed', 'true');
    document.head.appendChild(xDefault);

    return () => {
      document.querySelectorAll('link[data-hreflang-managed]').forEach(el => el.remove());
    };
  }, [language, path]);
}
