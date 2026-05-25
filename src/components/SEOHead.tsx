import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';

const SITE_URL = 'https://crawlers.fr';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const PERSON_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${SITE_URL}/a-propos#adrien-de-volontat`,
  name: 'Adrien de Volontat',
  jobTitle: 'Professionnel du SEO/GEO, fondateur de Crawlers.fr',
  description: "Professionnel du SEO et du GEO (Generative Engine Optimization). A conçu Crawlers.fr en 2026 pour répondre aux limites des suites SEO historiques face aux moteurs génératifs (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews).",
  url: `${SITE_URL}/a-propos`,
  worksFor: { '@id': `${SITE_URL}/#organization` },
  knowsAbout: [
    'SEO technique',
    'Generative Engine Optimization (GEO)',
    'Answer Engine Optimization (AEO)',
    'Visibilité LLM (ChatGPT, Claude, Perplexity, Gemini)',
    'E-E-A-T',
    'Cocon sémantique 3D',
    'Crawl & log analysis',
    'Core Web Vitals',
    'Schema.org',
  ],
  sameAs: [
    'https://www.linkedin.com/in/adriendevolontat/',
  ],
};

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Crawlers.fr',
  alternateName: ['Crawlers', 'Crawlers AI'],
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/og-image.png`,
    width: 1200,
    height: 630,
  },
  description: 'Plateforme SEO & GEO tout-en-un, conçue par un professionnel du SEO/GEO : audits, maillage intelligent, autopilote, visibilité IA générative (ChatGPT, Gemini, Perplexity, Claude).',
  foundingDate: '2026-03-18',
  founder: { '@id': `${SITE_URL}/a-propos#adrien-de-volontat` },
  areaServed: ['FR', 'BE', 'CH', 'CA', 'LU', 'MC'],
  knowsAbout: [
    'SEO technique',
    'Generative Engine Optimization',
    'Answer Engine Optimization',
    'Visibilité LLM',
    'Cocon sémantique',
    'E-E-A-T',
    'GEO Score',
    'Google Business Profile',
    'Core Web Vitals',
    'Schema.org',
    'Machine Learning prédictif SEO',
    'Crawl analysis',
    'PageRank interne',
  ],
  sameAs: [
    'https://www.linkedin.com/company/crawlers-fr/',
    'https://twitter.com/crawlersfr',
    'https://x.com/crawlersfr',
    'https://github.com/crawlers-fr',
    'https://www.youtube.com/@crawlersfr',
    `${SITE_URL}/a-propos`,
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'contact@crawlers.fr',
    url: `${SITE_URL}/aide`,
    availableLanguage: ['French', 'English', 'Spanish'],
  },
};

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Crawlers.fr',
  url: SITE_URL,
  inLanguage: ['fr', 'en', 'es'],
  publisher: { '@type': 'Organization', name: 'Crawlers', url: SITE_URL },
  // Référence explicite du sitemap XML (signal pour crawlers & moteurs génératifs)
  hasPart: {
    '@type': 'WebPage',
    '@id': `${SITE_URL}/sitemap.xml`,
    name: 'Sitemap XML',
    url: `${SITE_URL}/sitemap.xml`,
    encodingFormat: 'application/xml',
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/blog?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
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

      {/* Organization + WebSite JSON-LD (global, inclut référence sitemap) */}
      <script type="application/ld+json">{JSON.stringify(ORGANIZATION_JSON_LD)}</script>
      <script type="application/ld+json">{JSON.stringify(WEBSITE_JSON_LD)}</script>

      {children}
    </Helmet>
  );
}
