/**
 * Sanitisation HTML isomorphe.
 *
 * DOMPurify a besoin d'un DOM : côté serveur (SSR / Worker Cloudflare), son
 * export par défaut est un factory non initialisé et `DOMPurify.sanitize`
 * n'est pas une fonction. Appelé pendant le rendu serveur, il faisait planter
 * la branche React de l'article : le HTML servi aux robots ne contenait plus
 * que le spinner de secours (aucun H1, aucun texte). Les crawlers IA, qui
 * n'exécutent pas le JS, ne voyaient donc rien du tout.
 *
 * Stratégie :
 * - navigateur : DOMPurify (protection XSS complète, inchangée) ;
 * - serveur : nettoyage déterministe par liste noire, suffisant car le HTML
 *   provient de la base éditoriale (CMS interne) et sera de toute façon
 *   re-sanitisé par DOMPurify à l'hydratation.
 */

const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|noscript|template|form|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_CLOSING = /<(script|style|iframe|object|embed|link|meta|base|input|button|textarea|select)\b[^>]*\/?>/gi;
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URIS = /\s+(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data)\s*:[^"]*"|'\s*(?:javascript|vbscript|data)\s*:[^']*'|(?:javascript|vbscript|data):[^\s>]*)/gi;
const STYLE_ATTR = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Nettoyage serveur : retire scripts, handlers inline et URI exécutables. */
export function sanitizeHtmlServer(html: string): string {
  if (!html) return '';
  let out = html;
  // Plusieurs passes : un bloc retiré peut révéler un bloc imbriqué.
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out
      .replace(DANGEROUS_BLOCKS, '')
      .replace(DANGEROUS_SELF_CLOSING, '')
      .replace(EVENT_HANDLERS, '')
      .replace(DANGEROUS_URIS, '')
      .replace(STYLE_ATTR, '');
    if (out === before) break;
  }
  return out;
}

/**
 * Sanitise du HTML éditorial, quel que soit l'environnement d'exécution.
 * Ne jette jamais : en cas d'échec on retombe sur le nettoyage déterministe.
 */
export function sanitizeEditorialHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return sanitizeHtmlServer(html);
  }
  try {
    // Import synchrone résolu au bundle client uniquement à l'usage.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const purify = (globalThis as any).__crawlersPurify;
    if (purify?.sanitize) return purifyWith(purify, html);
  } catch {
    /* ignore */
  }
  return sanitizeHtmlServer(html);
}

export function purifyWith(purify: { sanitize: (h: string, o?: unknown) => string }, html: string): string {
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'loading', 'fetchpriority', 'decoding', 'srcset', 'sizes'],
    FORBID_TAGS: ['style'],
  });
}
