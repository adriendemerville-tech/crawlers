import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';

/**
 * Route-aware canonical/hreflang injector.
 *
 * Placed once inside <BrowserRouter>, it guarantees that every route
 * (including redirects, private pages and future pages) gets a
 * <link rel="canonical"> pointing to https://crawlers.fr/{route}.
 *
 * Pages that need an explicit canonical can still call useCanonicalHreflang(path)
 * to override the default location-derived value.
 */
export function CanonicalHreflangGlobal() {
  useCanonicalHreflang();
  return null;
}
