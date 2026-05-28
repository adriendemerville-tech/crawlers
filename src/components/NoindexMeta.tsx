import { Helmet } from 'react-helmet-async';

/**
 * Composant à insérer dans une page publique qu'on ne veut PAS indexer
 * (feature secondaire, doublon, page utilitaire). Garde follow pour
 * laisser le jus de lien circuler vers les pages piliers.
 *
 * Usage : <NoindexMeta /> en haut du return de la page.
 */
export function NoindexMeta() {
  return (
    <Helmet>
      <meta name="robots" content="noindex,follow" />
    </Helmet>
  );
}
