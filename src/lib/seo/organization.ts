/**
 * Nœud d'identité canonique de Crawlers.fr (schema.org Organization).
 *
 * Un agent IA lit ce nœud pour décider si l'entreprise est réelle avant de la
 * recommander : la corroboration repose sur `identifier` (SIREN, TVA),
 * `contactPoint`, `founder` et `sameAs` (profils externes officiels), cohérents
 * entre le site et les registres légaux.
 *
 * Source unique : ne jamais dupliquer ces valeurs ailleurs. Les autres schémas
 * (Article.publisher, VideoObject.publisher…) référencent `ORGANIZATION_REF`
 * via `@id`, ce qui évite les nœuds concurrents et incomplets.
 */

export const SITE_URL_CANONICAL = 'https://crawlers.fr';

export const ORGANIZATION_ID = `${SITE_URL_CANONICAL}/#organization`;

/** Profils EXTERNES officiels de Crawlers.fr (annuaires de confiance, LinkedIn société, Product Hunt, G2…).
 *  Jamais une page de crawlers.fr ni un profil personnel. */
export const SAME_AS: string[] = [];
/** Email public de contact : mettre l'adresse ici quand la réception de la boîte est confirmée. null = pas d'email publié. */
export const CONTACT_EMAIL: string | null = null;

/** Référence légère utilisable partout où un `publisher`/`provider` est attendu. */
export const ORGANIZATION_REF = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Crawlers.fr',
  url: SITE_URL_CANONICAL,
} as const;

const emailField: { email?: string } = CONTACT_EMAIL ? { email: CONTACT_EMAIL } : {};
const sameAsField: { sameAs?: string[] } = SAME_AS.length > 0 ? { sameAs: SAME_AS } : {};

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
  ...emailField,
  foundingDate: '2025',
  slogan: 'Visible dans Google comme dans les réponses des IA.',
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
      ...emailField,
      url: `${SITE_URL_CANONICAL}/contact`,
      availableLanguage: ['fr', 'en', 'es'],
      areaServed: 'FR',
    },
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      ...emailField,
      url: `${SITE_URL_CANONICAL}/tarifs`,
      availableLanguage: ['fr', 'en'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'technical support',
      ...emailField,
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
  ...sameAsField,
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
