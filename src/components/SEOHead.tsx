import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE_URL = 'https://crawlers.fr';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Crawlers',
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description: 'Plateforme SEO & GEO tout-en-un : audits, maillage intelligent, autopilote, visibilité IA.',
  sameAs: [
    'https://twitter.com/crawlersfr',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${SITE_URL}/aide`,
    availableLanguage: ['French', 'English', 'Spanish'],
  },
};

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  /** Override og:type (default: "website") */
  ogType?: string;
  /** Set to true for private/utility pages (noindex) */
  noIndex?: boolean;
  /** Additional children inside Helmet */
  children?: React.ReactNode;
}

/**
 * Shared SEO component providing:
 * - meta robots (index/noindex based on language & noIndex prop)
 * - Open Graph tags
 * - Twitter Card tags
 * 
 * NOTE: canonical + hreflang are handled by useCanonicalHreflang hook.
 * Page-specific JSON-LD should be added via children or separate scripts.
 */
export function SEOHead({ title, description, path, ogType = 'website', noIndex = false, children }: SEOHeadProps) {
  const { language } = useLanguage();

  const cleanPath = path === '/' ? '' : path;
  const pageUrl = language === 'fr'
    ? `${SITE_URL}${cleanPath || '/'}`
    : `${SITE_URL}${cleanPath || '/'}?lang=${language}`;

  // Non-FR language variants should not be indexed (per spec)
  const shouldNoIndex = noIndex || language !== 'fr';

  const robotsContent = shouldNoIndex
    ? 'noindex, follow'
    : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

  const ogTitle = `${title} | Crawlers.fr`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Crawlers.fr" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:locale" content="fr_FR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@crawlersfr" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {children}
    </Helmet>
  );
}
