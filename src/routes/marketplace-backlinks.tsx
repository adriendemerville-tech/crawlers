import { createFileRoute } from '@tanstack/react-router';
import MarketplaceBacklinksLanding, { MARKETPLACE_FAQ } from '@/pages/MarketplaceBacklinksLanding';
import { pageHead, SITE_URL } from '@/lib/seo/pageHead';

const URL = `${SITE_URL}/marketplace-backlinks`;

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Place d’échange de backlinks Crawlers.fr',
    serviceType: 'Achat, vente et troc d’emplacements de liens à prix déterministe',
    url: URL,
    description:
      'Place d’échange de backlinks où le prix, l’attribut du lien et les plafonds d’insertion sont calculés à partir des données de crawl et de Search Console, avec vérification de publication et commission de 15 %.',
    areaServed: 'FR',
    provider: { '@type': 'Organization', name: 'Crawlers.fr', url: SITE_URL },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '40',
      highPrice: '350',
      offerCount: '5',
      description: 'Cinq paliers de prix P1 à P5, de 40 € à 350 € par emplacement de lien.',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MARKETPLACE_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Référencement IA & GEO',
        item: `${SITE_URL}/generative-engine-optimization`,
      },
      { '@type': 'ListItem', position: 3, name: 'Place d’échange de backlinks', item: URL },
    ],
  },
];

export const Route = createFileRoute('/marketplace-backlinks')({
  head: () =>
    pageHead({
      title: 'Place d’échange de backlinks — prix déterministe',
      description:
        'Achetez et vendez un backlink à un prix calculé : 5 paliers de 40 à 350 €, attribut imposé par le besoin réel, plafonds d’insertion et vérification de publication.',
      path: '/marketplace-backlinks',
      keywords:
        'place d’échange backlinks, acheter backlink, vendre backlink, échange de liens, netlinking',
      jsonLd,
    }),
  component: MarketplaceBacklinksLanding,
});
