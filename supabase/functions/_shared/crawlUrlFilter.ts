const NON_PAGE_EXTENSIONS = /\.(xml|xsl|xslt|pdf|zip|gz|tar|rar|7z|exe|dmg|iso|bin|css|js|json|woff|woff2|ttf|eot|otf|svg|ico|png|jpg|jpeg|gif|webp|avif|mp3|mp4|avi|mov|wmv|flv|swf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|log|bak|sql|db)$/i;
const NON_PAGE_PATTERNS = /\/(sitemap[^/]*\.xml|feed\/?|rss\/?|atom\/?|wp-json\/?|wp-admin|wp-includes|xmlrpc\.php|robots\.txt)/i;
const PRIVATE_ROUTE_PATTERNS = /\/(auth|login|logout|signup|register|console|dashboard|admin|account|profil(?:e)?|settings|checkout|billing)(?:\/|$)/i;
const PRIVATE_QUERY_KEYS = new Set(['returnto', 'redirect', 'redirectto', 'callback', 'token', 'code', 'session']);

/**
 * Query params that never change the indexable content of a page:
 * UI state (tabs, accordions, view modes, sorting), tracking, and session noise.
 * They are stripped before crawling so the same page is not scraped N times.
 */
const NOISE_QUERY_KEYS = new Set([
  // UI state
  'tab', 'tabs', 'view', 'mode', 'panel', 'section', 'accordion', 'modal',
  'sort', 'sortby', 'order', 'orderby', 'dir', 'display', 'layout',
  'filter', 'filters', 'scroll', 'anchor', 'open', 'expanded', 'active',
  'preview', 'print', 'replytocom', 'highlight', 'sidebar', 'step',
  // Tracking
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'ttclid',
  'igshid', 'mc_cid', 'mc_eid', 'ref', 'referrer', 'source', 'campaign',
  '_ga', '_gl', 'pk_campaign', 'pk_kwd', 'piwik_campaign', 'hsa_acc', 'hsa_cam',
  'hsctatracking', '__hstc', '__hssc', '__hsfp', 'trk', 'trkcampaign',
]);

const NOISE_QUERY_PREFIXES = ['utm_', 'sc_', 'at_', 'vero_', 'oly_', 'matomo_'];

function isNoiseQueryKey(key: string): boolean {
  const k = key.toLowerCase();
  if (NOISE_QUERY_KEYS.has(k)) return true;
  return NOISE_QUERY_PREFIXES.some((p) => k.startsWith(p));
}

/**
 * Canonicalise une URL avant crawl :
 * - supprime le fragment (#...)
 * - retire les paramètres de bruit (UI state + tracking)
 * - trie les paramètres restants (pagination, filtres produits légitimes)
 * - normalise le slash final
 * Retourne null si l'URL est invalide.
 */
export function canonicalizeCrawlUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';

    const keep: [string, string][] = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (isNoiseQueryKey(key)) continue;
      keep.push([key, value]);
    }
    keep.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    const search = new URLSearchParams(keep).toString();
    parsed.search = search ? `?${search}` : '';

    // slash final retiré (sauf racine) pour éviter les doublons /a et /a/
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    // segments dupliqués //
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isCrawlablePublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (NON_PAGE_EXTENSIONS.test(parsed.pathname) || NON_PAGE_PATTERNS.test(parsed.pathname)) return false;
    if (PRIVATE_ROUTE_PATTERNS.test(parsed.pathname)) return false;
    for (const key of parsed.searchParams.keys()) {
      if (PRIVATE_QUERY_KEYS.has(key.toLowerCase())) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Filtre + canonicalise + déduplique une liste d'URLs à crawler.
 * L'ordre d'origine est conservé (première occurrence gagne).
 */
export function filterCrawlablePublicUrls(rawUrls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawUrls) {
    if (!isCrawlablePublicUrl(raw)) continue;
    const canonical = canonicalizeCrawlUrl(raw);
    if (!canonical) continue;
    const key = canonical.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}
