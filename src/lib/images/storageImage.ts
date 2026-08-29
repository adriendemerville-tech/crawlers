/**
 * Réécrit une URL publique du stockage vers l'endpoint de transformation
 * d'images, afin d'obtenir une version redimensionnée (et servie en WebP
 * quand le navigateur l'accepte) au lieu du fichier d'origine.
 *
 * Les URL externes ou déjà transformées sont retournées inchangées.
 */
const PUBLIC_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

export function storageImage(
  url: string | null | undefined,
  width: number,
  quality = 70,
): string {
  if (!url) return "";
  if (url.includes(RENDER_SEGMENT)) return url;
  if (!url.includes(PUBLIC_SEGMENT)) return url;

  const base = url.split("?")[0].replace(PUBLIC_SEGMENT, RENDER_SEGMENT);
  return `${base}?width=${width}&resize=contain&quality=${quality}`;
}

/** srcSet 1x/2x pour une largeur d'affichage donnée. */
export function storageImageSrcSet(
  url: string | null | undefined,
  width: number,
  quality = 70,
): string | undefined {
  if (!url || !url.includes(PUBLIC_SEGMENT)) return undefined;
  return `${storageImage(url, width, quality)} ${width}w, ${storageImage(url, width * 2, quality)} ${width * 2}w`;
}
