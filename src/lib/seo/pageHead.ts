/**
 * Centralised SEO head builder for TanStack Router `head()` options.
 *
 * Replaces the legacy react-helmet-async approach: tags returned here are
 * rendered server-side by <HeadContent />, so every page ships a unique
 * title / description / canonical in the initial HTML.
 */

export const SITE_URL = 'https://crawlers.fr';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface PageHeadOptions {
  /** Page <title>. "| Crawlers.fr" is appended when missing. */
  title: string;
  description: string;
  /** Absolute path of the page, e.g. "/tarifs". Used for canonical + og:url. */
  path: string;
  /**
   * Overrides the canonical target when another page owns the intention
   * (ex. /app/site-crawl → /crawl). og:url suit le canonical.
   */
  canonicalPath?: string;

  /** og:type (default "website") */
  ogType?: string;
  /** Private / utility pages → noindex, follow */
  noIndex?: boolean;
  /** Absolute https URL of the social preview image */
  image?: string;
  keywords?: string;
  /** Extra meta entries appended after the defaults */
  extraMeta?: Array<Record<string, string>>;
  /** JSON-LD payloads rendered as <script type="application/ld+json"> */
  jsonLd?: unknown[];
}

const INDEXABLE =
  'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

export function pageHead(options: PageHeadOptions) {
  const {
    title,
    description,
    path,
    canonicalPath,
    ogType = 'website',
    noIndex = false,
    image = DEFAULT_OG_IMAGE,
    keywords,
    extraMeta,
    jsonLd,
  } = options;

  const toUrl = (p: string) => {
    const clean = p === '/' ? '' : p.replace(/\/$/, '');
    return `${SITE_URL}${clean || '/'}`;
  };
  const url = toUrl(path);
  const canonicalUrl = canonicalPath ? toUrl(canonicalPath) : url;
  const fullTitle = /crawlers/i.test(title) ? title : `${title} | Crawlers.fr`;


  const meta: Array<Record<string, string>> = [
    { title: fullTitle },
    { name: 'description', content: description },
    { name: 'robots', content: noIndex ? 'noindex, follow' : INDEXABLE },
    { property: 'og:type', content: ogType },
    { property: 'og:site_name', content: 'Crawlers.fr' },
    { property: 'og:url', content: url },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:locale', content: 'fr_FR' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@crawlersfr' },
    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];

  if (keywords) meta.push({ name: 'keywords', content: keywords });
  if (extraMeta) meta.push(...extraMeta);

  return {
    meta,
    links: [{ rel: 'canonical', href: canonicalUrl }],
    ...(jsonLd && jsonLd.length
      ? {
          scripts: jsonLd.map((payload) => ({
            type: 'application/ld+json',
            children: JSON.stringify(payload),
          })),
        }
      : {}),
  };
}
