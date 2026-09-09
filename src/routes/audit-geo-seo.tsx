import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { pageHead, DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo/pageHead';
import { ORGANIZATION_REF } from '@/lib/seo/organization';

const ParmenionLanding = lazy(() => import('@/pages/ParmenionLanding'));

const URL = 'https://crawlers.fr/audit-geo-seo';
const PRODUCT_ID = `${URL}#produit`;
const OFFER_ID = `${URL}#offre`;
const WEBPAGE_ID = `${URL}#webpage`;

const FAQ: Array<[string, string]> = [
  ['Que contient exactement la passe Parmenion ?', 'Un audit technique et éditorial de votre site, la rédaction de 3 pages de contenu, l\'optimisation de votre fiche Google Maps, et un compte rendu avant / après.'],
  ['Combien de temps ça prend ?', 'L\'audit est gratuit et immédiat. Une fois la passe payée, le déploiement complet est réalisé sous 72 heures ouvrées.'],
  ['Puis-je annuler et me faire rembourser ?', 'Oui. Vous êtes remboursé intégralement tant qu\'aucun correctif n\'a été déployé sur votre site ou votre fiche Google Maps.'],
  ['Que se passe-t-il si je n\'ai pas de fiche Google Maps ?', 'Nous vous guidons pour la créer. C\'est inclus dans la passe.'],
  ['Les 3 contenus sont-ils écrits par une IA ?', 'Les premiers brouillons sont produits par notre moteur éditorial, puis relus, ajustés et validés par vos soins avant publication.'],
];

/** Les 4 étapes affichées dans la page (STEPS de ParmenionLanding). */
const STEPS: Array<[string, string]> = [
  ['On lit votre site comme un moteur IA', 'Crawl du site, extraction du contenu réellement servi, détection de votre activité, de votre zone et de vos concurrents directs.'],
  ['On mesure ce qui bloque', 'Titres, métadonnées, hiérarchie, données structurées, vitesse, maillage, citabilité des passages : chaque constat est chiffré et priorisé.'],
  ['On rédige et on corrige', 'Trois pages de contenu sur les sujets qui rapportent des clients, plus les correctifs techniques et votre fiche Google Maps.'],
  ['Vous validez, puis on déploie', 'Rien n\'est publié avant votre accord. Chaque déploiement est journalisé et réversible, avec un compte rendu avant / après.'],
];


export const Route = createFileRoute('/audit-geo-seo')({
  head: () =>
    pageHead({
      title: 'Audit GEO SEO local — Corrigez votre visibilité IA et Google Maps',
      description:
        'Passe unique Crawlers.fr : audit GEO SEO, 3 contenus rédigés, optimisation Google Maps. Rien n\'est déployé avant votre validation.',
      path: '/audit-geo-seo',
      keywords:
        'audit geo seo, référencement local, optimisation google maps, visibilité ia, audit site prix fixe',
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
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
            { '@type': 'ListItem', position: 2, name: 'Tarifs', item: 'https://crawlers.fr/tarifs' },
            { '@type': 'ListItem', position: 3, name: 'Audit GEO SEO local', item: URL },
          ],
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
          name: 'Audit GEO SEO local — Corrigez votre visibilité IA et Google Maps',
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: ['h1', '.citable-passage'],
          },
        },
      ],
    }),
  component: ParmenionLanding,
});
