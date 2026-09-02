/**
 * Nœud d'identité canonique de Crawlers.fr (schema.org Organization).
 *
 * Un agent IA lit ce nœud pour décider si l'entreprise est réelle avant de la
 * recommander : la corroboration repose sur `postalAddress` + `contactPoint` +
 * `sameAs` + `identifier` (SIREN), cohérents entre le site, la fiche Google
 * Business et l'annuaire légal.
 *
 * Source unique : ne jamais dupliquer ces valeurs ailleurs. Les autres schémas
 * (Article.publisher, VideoObject.publisher…) référencent `ORGANIZATION_REF`
 * via `@id`, ce qui évite les nœuds concurrents et incomplets.
 */

export const SITE_URL_CANONICAL = 'https://crawlers.fr';

export const ORGANIZATION_ID = `${SITE_URL_CANONICAL}/#organization`;

/** Référence légère utilisable partout où un `publisher`/`provider` est attendu. */
export const ORGANIZATION_REF = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Crawlers.fr',
  url: SITE_URL_CANONICAL,
} as const;

/** Nœud complet, émis une seule fois par page (JSON-LD sitewide du root). */
export const ORGANIZATION_NODE = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Crawlers.fr',
  legalName: 'Voluntas Novare',
  alternateName: [
    'Crawlers',
    'Crawlers SEO GEO',
    "Plateforme SaaS d'acquisition",
    'Suite GEO',
    "Plateforme d'intelligence de visibilité",
  ],
  url: SITE_URL_CANONICAL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL_CANONICAL}/crawlers-logo-violet.png`,
    caption: 'Logo Crawlers.fr',
  },
  image: `${SITE_URL_CANONICAL}/og-image.png`,
  description:
    "Plateforme SaaS d'acquisition française : suite GEO et plateforme d'intelligence de visibilité réunissant diagnostic technique, score de citabilité par les moteurs génératifs, correction automatique des pages et connexion directe aux CMS.",
  email: 'contact@crawlers.fr',
  foundingDate: '2025',
  slogan: 'Visible dans Google comme dans les réponses des IA.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Saint-Rémy-de-Provence',
    addressLocality: 'Saint-Rémy-de-Provence',
    postalCode: '13210',
    addressRegion: 'Provence-Alpes-Côte d\u2019Azur',
    addressCountry: 'FR',
  },
  areaServed: [
    { '@type': 'Country', name: 'France' },
    { '@type': 'Country', name: 'Belgique' },
    { '@type': 'Country', name: 'Suisse' },
    { '@type': 'Country', name: 'Canada' },
  ],
  identifier: [
    {
      '@type': 'PropertyValue',
      propertyID: 'SIREN',
      value: '992399667',
    },
    {
      '@type': 'PropertyValue',
      propertyID: 'VAT',
      name: 'TVA intracommunautaire',
      value: 'FR-992399667',
    },
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'contact@crawlers.fr',
      url: `${SITE_URL_CANONICAL}/contact`,
      availableLanguage: ['fr', 'en', 'es'],
      areaServed: 'FR',
    },
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'contact@crawlers.fr',
      url: `${SITE_URL_CANONICAL}/tarifs`,
      availableLanguage: ['fr', 'en'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'technical support',
      email: 'contact@crawlers.fr',
      url: `${SITE_URL_CANONICAL}/aide`,
      availableLanguage: ['fr', 'en'],
    },
  ],
  founder: {
    '@type': 'Person',
    '@id': `${SITE_URL_CANONICAL}/auteur/adrien-de-volontat#person`,
    name: 'Adrien de Volontat',
    jobTitle: 'Fondateur et directeur de la publication',
    url: `${SITE_URL_CANONICAL}/auteur/adrien-de-volontat`,
    sameAs: ['https://www.linkedin.com/in/adrien-de-volontat/'],
  },
  publishingPrinciples: `${SITE_URL_CANONICAL}/methodologie`,
  knowsAbout: [
    'Optimisation pour les moteurs de recherche',
    'Generative Engine Optimization',
    'Audit technique de site web',
    'Données structurées schema.org',
    'Maillage interne et cocon sémantique',
    'E-E-A-T',
  ],
  sameAs: ['https://www.linkedin.com/in/adrien-de-volontat/'],
} as const;

/** Nœud WebSite lié à l'Organization, avec action de recherche. */
export const WEBSITE_NODE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL_CANONICAL}/#website`,
  name: 'Crawlers.fr',
  url: SITE_URL_CANONICAL,
  inLanguage: 'fr-FR',
  publisher: { '@id': ORGANIZATION_ID },
} as const;

/** Graphe sitewide à injecter une fois dans le head du root. */
export const SITEWIDE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [ORGANIZATION_NODE, WEBSITE_NODE],
};
