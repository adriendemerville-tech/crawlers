/**
 * Normalisation SEO/GEO des réponses non-200 (404 / 410).
 *
 * Le head sitewide déclare `index, follow` : sur une page d'erreur, ce signal
 * est faux et contredit le statut HTTP. Les crawlers (dont les agents IA) lisent
 * le HTML initial, pas le DOM hydraté — la balise injectée côté client arrive
 * trop tard. On réécrit donc la balise dans la réponse serveur et on double le
 * signal par un header `X-Robots-Tag`.
 */
const ROBOTS_META_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i;
const NOINDEX_META = '<meta name="robots" content="noindex, follow"/>';

export function applyNotFoundSeo(html: string): string {
  if (ROBOTS_META_RE.test(html)) {
    return html.replace(ROBOTS_META_RE, NOINDEX_META);
  }
  // Pas de balise robots dans le head : on l'insère juste après <head>.
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${NOINDEX_META}`);
}

export function isNonIndexableStatus(status: number): boolean {
  return status === 404 || status === 410;
}
