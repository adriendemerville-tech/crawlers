/**
 * SSR normalisation of the `?lang=` variants.
 *
 * EN/ES variants are thin duplicates of the FR pages: they must be
 * `noindex, nofollow` and point their canonical at the query-free FR URL.
 * Until now this was only enforced client-side (useCanonicalHreflang), so
 * crawlers reading the raw SSR HTML still saw `index, follow` and could
 * index `?lang=en` URLs.
 *
 * These helpers are pure string transforms so they can be unit-tested and
 * imported safely from the request middleware.
 */

export const SITE_URL = 'https://crawlers.fr';

/** Languages considered indexable (the site is FR-only for SEO purposes). */
const INDEXABLE_LANGS = new Set(['', 'fr', 'fr-fr']);

/** Returns true when the URL carries a non-FR language variant. */
export function isNonFrLangVariant(url: URL): boolean {
  const lang = url.searchParams.get('lang');
  if (lang === null) return false;
  return !INDEXABLE_LANGS.has(lang.trim().toLowerCase());
}

/** Canonical FR URL for a given pathname (no query string, no trailing slash). */
export function canonicalFrUrl(pathname: string): string {
  const clean = pathname === '/' ? '' : pathname.replace(/\/+$/, '');
  return `${SITE_URL}${clean || '/'}`;
}

const ROBOTS_META = /<meta\b[^>]*\bname=["'](?:robots|googlebot|bingbot)["'][^>]*>/gi;
const CANONICAL_LINK = /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi;
const HREFLANG_LINK = /<link\b[^>]*\bhreflang=[^>]*>/gi;

/**
 * Rewrites the SSR HTML of a non-FR language variant:
 * - single `<meta name="robots" content="noindex, nofollow">`
 * - single self-consistent canonical pointing at the FR URL
 * - every hreflang alternate removed
 */
export function applyLangVariantSeo(html: string, pathname: string): string {
  const canonical = canonicalFrUrl(pathname);

  let out = html
    .replace(ROBOTS_META, '')
    .replace(CANONICAL_LINK, '')
    .replace(HREFLANG_LINK, '');

  const injected =
    `<meta name="robots" content="noindex, nofollow"/>` +
    `<link rel="canonical" href="${canonical}"/>`;

  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${injected}</head>`);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${injected}`);
  }

  return out;
}
