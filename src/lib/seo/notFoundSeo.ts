/**
 * Normalisation SEO/GEO des réponses non-200 (404 / 410).
 *
 * Le head sitewide déclare le titre et la meta de l'accueil, plus `index, follow`.
 * Sur une ressource absente, TanStack Router arrête le head à la route qui porte
 * le `notFoundComponent` (la racine) : le document SSR garderait donc le titre
 * de l'accueil. Les crawlers lisent ce HTML initial. On aligne le head de la
 * racine quand le match est une 404, et on réécrit les mêmes balises dans la
 * réponse serveur (filet, au cas où le head n'aurait pas été appliqué). Le
 * `noindex` est doublé par le header `X-Robots-Tag`. Pas de canonical : la
 * ressource n'existe pas.
 */

export const NOT_FOUND_TITLE = "Page introuvable | Crawlers.fr";
export const NOT_FOUND_DESCRIPTION =
  "Cette adresse ne correspond à aucune page de Crawlers.fr.";

const HOME_TITLE = "Audit SEO et GEO : visibilité Google et IA | Crawlers";

const ROBOTS_META_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i;
const NOINDEX_META = '<meta name="robots" content="noindex, follow"/>';

const TITLE_META_KEYS = new Set(["og:title", "twitter:title"]);
const DESCRIPTION_META_KEYS = new Set([
  "description",
  "og:description",
  "twitter:description",
]);

export interface NotFoundHeadContext {
  match?: { _notFound?: boolean; status?: string };
  matches?: readonly { _notFound?: boolean; status?: string }[];
}

type MetaEntry = Record<string, string>;

export function isNotFoundHeadContext(ctx: NotFoundHeadContext): boolean {
  const candidates = [ctx.match, ...(ctx.matches ?? [])];
  return candidates.some(
    (match) => match?._notFound === true || match?.status === "notFound",
  );
}

function rewriteNotFoundMeta(entry: MetaEntry): MetaEntry {
  if (typeof entry.title === "string") {
    return { ...entry, title: NOT_FOUND_TITLE };
  }
  const key = entry.name ?? entry.property;
  if (key && TITLE_META_KEYS.has(key)) {
    return { ...entry, content: NOT_FOUND_TITLE };
  }
  if (key && DESCRIPTION_META_KEYS.has(key)) {
    return { ...entry, content: NOT_FOUND_DESCRIPTION };
  }
  return entry;
}

/**
 * Remplace titre et meta description (et leurs équivalents Open Graph / Twitter)
 * quand le document rendu est une 404. Les autres balises, dont `robots` et les
 * liens (pas de canonical ajoutée), restent celles du head appelant.
 */
export function withNotFoundHead<T extends { meta?: readonly MetaEntry[] }>(
  head: T,
  ctx: NotFoundHeadContext,
): T {
  if (!isNotFoundHeadContext(ctx) || head.meta == null) return head;
  return {
    ...head,
    meta: head.meta.map((entry) => rewriteNotFoundMeta(entry)),
  } as T;
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTitle(html: string, title: string): string {
  const safe = escapeHtmlText(title);
  if (/<title\b[^>]*>[^<]*<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[^<]*<\/title>/gi, `<title>${safe}</title>`);
  }
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<title>${safe}</title>`);
}

function replaceMetaContent(html: string, key: string, content: string): string {
  const re = new RegExp(
    `<meta\\b[^>]*\\b(?:name|property)=(["'])${escapeRegExp(key)}\\1[^>]*>`,
    "gi",
  );
  const escaped = escapeHtmlAttr(content);
  return html.replace(re, (tag) => {
    if (/\bcontent\s*=\s*(["'])[^"']*\1/i.test(tag)) {
      return tag.replace(/\bcontent\s*=\s*(["'])[^"']*\1/i, `content="${escaped}"`);
    }
    return tag.replace(/\/?>$/, (end) => ` content="${escaped}"${end}`);
  });
}

function rewriteNotFoundDocument(html: string): string {
  let out = replaceTitle(html, NOT_FOUND_TITLE);
  out = replaceMetaContent(out, "description", NOT_FOUND_DESCRIPTION);
  out = replaceMetaContent(out, "og:title", NOT_FOUND_TITLE);
  out = replaceMetaContent(out, "og:description", NOT_FOUND_DESCRIPTION);
  out = replaceMetaContent(out, "twitter:title", NOT_FOUND_TITLE);
  out = replaceMetaContent(out, "twitter:description", NOT_FOUND_DESCRIPTION);
  return out;
}

export function applyNotFoundSeo(html: string): string {
  const withDocument = rewriteNotFoundDocument(html);
  if (ROBOTS_META_RE.test(withDocument)) {
    return withDocument.replace(ROBOTS_META_RE, NOINDEX_META);
  }
  // Pas de balise robots dans le head : on l'insère juste après <head>.
  return withDocument.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${NOINDEX_META}`);
}

export function isNonIndexableStatus(status: number): boolean {
  return status === 404 || status === 410;
}

/** Le titre d'accueil ne doit plus apparaître dans un document 404. */
export function containsHomeTitle(html: string): boolean {
  return html.includes(HOME_TITLE);
}
