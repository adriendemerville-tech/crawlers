/**
 * Construction des URLs d'images d'article.
 *
 * L'ancienne implémentation retirait `?w=...`/`&q=...` à coups d'expressions
 * régulières, ce qui pouvait supprimer le `?` de la chaîne de requête et
 * produire des URLs du type `.../photo-123&w=640&q=75` — refusées par le
 * navigateur (image cassée). On passe désormais par l'API URL, qui garantit
 * une chaîne de requête valide.
 */

/** Hôtes acceptant les paramètres de redimensionnement à la volée. */
function supportsResizing(url: string): boolean {
  return url.includes('unsplash.com') || url.includes('images.pexels.com');
}

export interface ImageVariantOptions {
  width: number;
  quality: number;
}

/** Retourne l'URL de l'image dimensionnée, ou l'URL d'origine si non supportée. */
export function buildImageUrl(src: string, { width, quality }: ImageVariantOptions): string {
  if (!src || !supportsResizing(src)) return src;
  try {
    const url = new URL(src, 'https://crawlers.fr');
    url.searchParams.set('w', String(width));
    url.searchParams.set('q', String(quality));
    url.searchParams.set('auto', 'format');
    return url.toString();
  } catch {
    return src;
  }
}

const DEFAULT_VARIANTS: ImageVariantOptions[] = [
  { width: 640, quality: 75 },
  { width: 828, quality: 75 },
  { width: 1200, quality: 80 },
  { width: 1920, quality: 80 },
];

/** srcset responsive ; `undefined` quand l'hôte ne redimensionne pas. */
export function buildImageSrcSet(
  src: string,
  variants: ImageVariantOptions[] = DEFAULT_VARIANTS,
): string | undefined {
  if (!src || !supportsResizing(src)) return undefined;
  return variants.map((v) => `${buildImageUrl(src, v)} ${v.width}w`).join(', ');
}
