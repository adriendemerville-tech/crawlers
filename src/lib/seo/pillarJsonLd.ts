import { KEYWORD_PILLARS } from '@/data/keywordPillars';
import { breadcrumbList } from './breadcrumb';

/**
 * SSR-safe JSON-LD for pillar pages (Article + FAQPage + BreadcrumbList).
 * Injected via the route head() so crawlers and LLMs see it in the HTML.
 */
export function pillarJsonLd(slug: string): unknown[] {
  const data = KEYWORD_PILLARS[slug];
  if (!data) return [];
  const canonical = `https://crawlers.fr/${data.slug}`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.h1,
      description: data.metaDesc,
      keywords: data.primaryKeyword,
      datePublished: data.datePublished,
      dateModified: data.datePublished,
      inLanguage: 'fr-FR',
      author: {
        '@type': 'Person',
        name: 'Adrien de Volontat',
        url: 'https://crawlers.fr/auteur/adrien-de-volontat',
      },
      publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
      mainEntityOfPage: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      ...breadcrumbList([
        { name: 'Accueil', url: 'https://crawlers.fr/' },
        { name: data.h1, url: canonical },
      ]),
    },
  ];
}
