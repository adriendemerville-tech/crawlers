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
 * Stratégie : nettoyage déterministe (identique serveur et client, donc aucune
 * divergence d'hydratation), puis passe DOMPurify côté navigateur uniquement,
 * en défense en profondeur.
 */

const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|noscript|template|form)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_CLOSING = /<(script|style|iframe|object|embed|link|meta|base|input|button|textarea|select)\b[^>]*\/?>/gi;
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URIS = /\s+(?:href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript)\s*:[^"]*"|'\s*(?:javascript|vbscript)\s*:[^']*'|(?:javascript|vbscript):[^\s>]*)/gi;
const STYLE_ATTR = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Nettoyage déterministe, sans DOM : scripts, handlers inline, URI exécutables. */
export function sanitizeHtmlDeterministic(html: string): string {
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

export const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'loading', 'fetchpriority', 'decoding', 'srcset', 'sizes'],
  FORBID_TAGS: ['style'],
} as const;

/** Passe DOMPurify, uniquement quand un DOM réel est disponible. */
export function sanitizeWithPurify(html: string): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    // Import paresseux : jamais évalué pendant le rendu serveur.
    const DOMPurify = (window as any).DOMPurify;
    if (typeof DOMPurify?.sanitize === 'function') {
      return DOMPurify.sanitize(html, PURIFY_CONFIG as unknown as Record<string, unknown>);
    }
  } catch {
    /* ignore */
  }
  return null;
}
