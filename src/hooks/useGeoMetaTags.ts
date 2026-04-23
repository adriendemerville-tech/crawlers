import { useEffect } from 'react';

/**
 * Injects GEO-specific meta tags for geographic and AI engine optimization.
 * Tags: geo.region, geo.position, ICBM, content-language, coverage,
 * distribution, revisit-after.
 *
 * Coordinates: Paris, France (Crawlers.fr HQ).
 */
export function useGeoMetaTags() {
  useEffect(() => {
    const tags: Array<{ name: string; content: string }> = [
      { name: 'geo.region', content: 'FR-75' },
      { name: 'geo.placename', content: 'Paris, France' },
      { name: 'geo.position', content: '48.8566;2.3522' },
      { name: 'ICBM', content: '48.8566, 2.3522' },
      { name: 'content-language', content: 'fr, en, es' },
      { name: 'coverage', content: 'Worldwide' },
      { name: 'distribution', content: 'global' },
      { name: 'revisit-after', content: '3 days' },
      { name: 'rating', content: 'general' },
      { name: 'target', content: 'all' },
    ];

    const elements: HTMLMetaElement[] = [];

    tags.forEach(({ name, content }) => {
      // Avoid duplicates
      if (document.querySelector(`meta[name="${name}"]`)) return;
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      meta.setAttribute('data-geo', 'true');
      document.head.appendChild(meta);
      elements.push(meta);
    });

    return () => {
      elements.forEach(el => el.remove());
    };
  }, []);
}
