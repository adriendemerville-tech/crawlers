const NON_PAGE_EXTENSIONS = /\.(xml|xsl|xslt|pdf|zip|gz|tar|rar|7z|exe|dmg|iso|bin|css|js|json|woff|woff2|ttf|eot|otf|svg|ico|png|jpg|jpeg|gif|webp|avif|mp3|mp4|avi|mov|wmv|flv|swf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|log|bak|sql|db)$/i;
const NON_PAGE_PATTERNS = /\/(sitemap[^/]*\.xml|feed\/?|rss\/?|atom\/?|wp-json\/?|wp-admin|wp-includes|xmlrpc\.php|robots\.txt)/i;
const PRIVATE_ROUTE_PATTERNS = /\/(auth|login|logout|signup|register|console|dashboard|admin|account|profil(?:e)?|settings|checkout|billing)(?:\/|$)/i;
const PRIVATE_QUERY_KEYS = new Set(['returnto', 'redirect', 'redirectto', 'callback', 'token', 'code', 'session']);

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

export function filterCrawlablePublicUrls(rawUrls: string[]): string[] {
  return rawUrls.filter(isCrawlablePublicUrl);
}