/**
 * JSON-LD builders for editorial pages (blog articles, guides, lexique terms).
 *
 * These run inside route `head()` so the structured data ships in the
 * server-rendered HTML instead of being injected client-side by Helmet.
 */

import { SITE_URL } from './pageHead';
import { resolveArticleDates } from '@/lib/blog/lastUpdated';


export interface ArticleJsonLdInput {
  title: string;
  description: string;
  /** Absolute page path, e.g. "/blog/mon-article" */
  path: string;
  /** Absolute image URL (falls back to the site OG image) */
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  author?: string;
  keywords?: string;
  section?: string;
}

const DEFAULT_KEYWORDS =
  'SEO, GEO, audit technique, visibilité IA, ChatGPT, Google SGE, JSON-LD, robots.txt';

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
  const url = `${SITE_URL}${input.path}`;
  const author = input.author && !/^adrien$/i.test(input.author)
    ? input.author
    : 'Adrien de Volontat';
  const authorSlug = author.toLowerCase().replace(/\s+/g, '-');
  // Normalisation unique : le JSON-LD porte exactement les mêmes dates que la
  // mention visible « Mis à jour le » (pas de dateModified fabriquée).
  const { datePublished, dateModified } = resolveArticleDates(
    input.datePublished,
    input.dateModified,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    ...(input.image ? { image: input.image } : {}),
    author: {
      '@type': 'Person',
      name: author,
      url: `${SITE_URL}/auteur/${authorSlug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Crawlers.fr',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
    },
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),

    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fr-FR',
    articleSection: input.section || 'SEO & GEO',
    keywords: input.keywords || DEFAULT_KEYWORDS,
  };
}

export function buildBreadcrumbJsonLd(
  trail: Array<{ name: string; path: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === '/' ? '' : item.path}` || SITE_URL,
    })),
  };
}

export function buildFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function buildDefinedTermJsonLd(input: {
  term: string;
  definition: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: input.term,
    description: input.definition,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Lexique SEO, GEO et IA — Crawlers.fr',
      url: `${SITE_URL}/lexique`,
    },
    url: `${SITE_URL}${input.path}`,
  };
}
