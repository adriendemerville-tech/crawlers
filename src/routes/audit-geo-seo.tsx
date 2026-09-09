import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { pageHead } from '@/lib/seo/pageHead';

const ParmenionLanding = lazy(() => import('@/pages/ParmenionLanding'));

const URL = 'https://crawlers.fr/passe-visibilite';

const FAQ: Array<[string, string]> = [
  ['Que contient exactement la passe Parmenion ?', 'Un audit technique et éditorial de votre site, la rédaction de 3 pages de contenu, l\'optimisation de votre fiche Google Maps, et un compte rendu avant / après.'],
  ['Combien de temps ça prend ?', 'L\'audit est gratuit et immédiat. Une fois la passe payée, le déploiement complet est réalisé sous 72 heures ouvrées.'],
  ['Puis-je annuler et me faire rembourser ?', 'Oui. Vous êtes remboursé intégralement tant qu\'aucun correctif n\'a été déployé sur votre site ou votre fiche Google Maps.'],
  ['Que se passe-t-il si je n\'ai pas de fiche Google Maps ?', 'Nous vous guidons pour la créer. C\'est inclus dans la passe.'],
  ['Les 3 contenus sont-ils écrits par une IA ?', 'Les premiers brouillons sont produits par notre moteur éditorial, puis relus, ajustés et validés par vos soins avant publication.'],
];

export const Route = createFileRoute('/audit-geo-seo')({
  head: () =>
    pageHead({
      title: 'Parmenion — Corrigez votre visibilité en ligne, une fois, à 59 € TTC',
      description:
        'Passe unique Crawlers.fr : audit SEO/GEO, 3 contenus rédigés, optimisation Google Maps. Rien n\'est déployé avant votre validation.',
      path: '/passe-visibilite',
      keywords:
        'audit site prix fixe, optimisation google maps, contenu seo, visibilité locale, référencement local, audit pas cher',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Parmenion — Passe visibilité unique',
          description:
            'Audit site, 3 contenus rédigés et optimisation Google Maps pour les TPE/PME. Paiement unique de 59 € TTC.',
          url: URL,
          brand: { '@type': 'Brand', name: 'Crawlers.fr' },
          offers: {
            '@type': 'Offer',
            price: '59',
            priceCurrency: 'EUR',
            priceValidUntil: '2027-12-31',
            availability: 'https://schema.org/InStock',
            url: URL,
            seller: { '@type': 'Organization', name: 'Crawlers.fr' },
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '73',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map(([q, a]) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          url: URL,
          name: 'Parmenion — Corrigez votre visibilité en ligne',
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: ['h1', '.citable-passage'],
          },
        },
      ],
    }),
  component: ParmenionLanding,
});
