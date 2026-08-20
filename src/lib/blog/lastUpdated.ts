/**
 * Résolution de la date de dernière mise à jour d'un article.
 *
 * Règles (volontairement conservatrices) :
 * - on n'affiche « Mis à jour le » que si le contenu a RÉELLEMENT changé,
 *   c'est-à-dire si `updated_at` dépasse la date de publication d'au moins
 *   `MIN_DELTA_HOURS`. Cela évite d'afficher une fausse mise à jour quand
 *   une simple retouche de métadonnée touche la ligne juste après publication ;
 * - on ne descend jamais sous la granularité du jour (pas d'heure : inutile
 *   pour le SEO et artificiel pour le lecteur) ;
 * - une date future ou invalide est ignorée.
 */

/** Écart minimum entre publication et mise à jour pour parler de révision. */
const MIN_DELTA_HOURS = 24;

function parse(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @returns date ISO tronquée au jour (YYYY-MM-DD) si la mise à jour est
 *          substantielle, sinon `null`.
 */
export function resolveLastUpdated(
  publishedAt?: string | null,
  updatedAt?: string | null,
): string | null {
  const updated = parse(updatedAt);
  if (!updated) return null;

  // Pas de date dans le futur (horloge serveur / import erroné)
  if (updated.getTime() > Date.now() + 60 * 60 * 1000) return null;

  const published = parse(publishedAt);
  if (published) {
    const deltaHours = (updated.getTime() - published.getTime()) / 36e5;
    if (deltaHours < MIN_DELTA_HOURS) return null;
  }

  return updated.toISOString().slice(0, 10);
}

/** Formatage jour/mois/année, sans heure. */
export function formatUpdatedDate(isoDay: string, language: string = 'fr'): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  const locale = language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'fr-FR';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}
