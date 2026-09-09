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
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': WEBPAGE_ID,
              url: URL,
              name: 'Audit GEO SEO local — Corrigez votre visibilité IA et Google Maps',
              description:
                'Passe unique Crawlers.fr : audit GEO SEO, 3 contenus rédigés, optimisation Google Maps. Rien n\'est déployé avant votre validation.',
              inLanguage: 'fr-FR',
              isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Crawlers.fr' },
              publisher: ORGANIZATION_REF,
              primaryImageOfPage: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
              breadcrumb: { '@id': `${URL}#breadcrumb` },
              mainEntity: { '@id': PRODUCT_ID },
              significantLink: [`${SITE_URL}/tarifs`, `${SITE_URL}/cgvu`],
              speakable: {
                '@type': 'SpeakableSpecification',
                cssSelector: ['h1', '.citable-passage'],
              },
            },
            {
              '@type': 'BreadcrumbList',
              '@id': `${URL}#breadcrumb`,
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Accueil', item: { '@type': 'Thing', '@id': `${SITE_URL}/`, name: 'Accueil' } },
                { '@type': 'ListItem', position: 2, name: 'Tarifs', item: { '@type': 'Thing', '@id': `${SITE_URL}/tarifs`, name: 'Tarifs' } },
                { '@type': 'ListItem', position: 3, name: 'Audit GEO SEO local', item: { '@type': 'Thing', '@id': URL, name: 'Audit GEO SEO local' } },
              ],
            },
            {
              '@type': 'Product',
              '@id': PRODUCT_ID,
              name: 'Parmenion — Passe visibilité unique',
              description:
                'Audit GEO SEO du site, 3 pages de contenu rédigées et optimisation de la fiche Google Maps pour les TPE/PME. Paiement unique de 59 € TTC, rien n\'est déployé avant validation.',
              url: URL,
              sku: 'CRAWLERS-PASSE-PARMENION',
              category: 'Référencement naturel et visibilité dans les moteurs génératifs',
              image: DEFAULT_OG_IMAGE,
              brand: { '@type': 'Brand', name: 'Crawlers.fr' },
              isRelatedTo: { '@id': `${URL}#service` },
              offers: {
                '@type': 'Offer',
                '@id': OFFER_ID,
                name: 'Passe visibilité — paiement unique',
                price: '59',
                priceCurrency: 'EUR',
                image: DEFAULT_OG_IMAGE,
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: '59',
                  priceCurrency: 'EUR',
                  valueAddedTaxIncluded: true,
                },
                priceValidUntil: '2027-12-31',
                validFrom: '2026-01-01',
                availability: 'https://schema.org/InStock',
                url: URL,
                areaServed: { '@type': 'Country', name: 'France' },
                eligibleRegion: { '@type': 'Country', name: 'France' },
                seller: ORGANIZATION_REF,
                acceptedPaymentMethod: {
                  '@type': 'PaymentMethod',
                  name: 'Carte bancaire',
                },
                shippingDetails: {
                  '@type': 'OfferShippingDetails',
                  shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'EUR' },
                  shippingDestination: { '@type': 'DefinedRegion', name: 'France' },
                  deliveryTime: {
                    '@type': 'ShippingDeliveryTime',
                    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'd' },
                    transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'd' },
                  },
                },
                hasMerchantReturnPolicy: {
                  '@type': 'MerchantReturnPolicy',
                  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
                  merchantReturnDays: 0,
                  returnMethod: 'https://schema.org/ReturnAtKiosk',
                  returnFees: 'https://schema.org/FreeReturn',
                },
              },
            },
            {
              '@type': 'Service',
              '@id': `${URL}#service`,
              name: 'Audit GEO SEO local et déploiement des correctifs',
              serviceType: 'Audit SEO et optimisation de visibilité dans les réponses IA',
              description:
                'Audit technique et éditorial, mesure de la citabilité par les moteurs génératifs, rédaction de contenu et optimisation de la fiche Google Business Profile, déployés après validation du client.',
              provider: ORGANIZATION_REF,
              areaServed: { '@type': 'Country', name: 'France' },
              audience: { '@type': 'BusinessAudience', name: 'TPE et PME locales' },
              termsOfService: `${SITE_URL}/cgvu`,
              offers: { '@id': OFFER_ID },
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Inclus dans la passe',
                itemListElement: [
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Audit de votre site', description: '6 à 10 correctifs prioritaires sur titres, descriptions, balisage, vitesse et maillage.' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: '3 pages de contenu', description: 'Rédigées sur les sujets qui rapportent des clients, relues et validées par vous.' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fiche Google Maps', description: 'Description, catégories, horaires, site web et une publication optimisée.' } },
                ],
              },
            },
            {
              '@type': 'HowTo',
              '@id': `${URL}#howto`,
              name: 'Comment se déroule la passe visibilité Crawlers.fr',
              description:
                'Quatre étapes, de l\'analyse du site au déploiement validé des correctifs et des contenus.',
              inLanguage: 'fr-FR',
              totalTime: 'P3D',
              estimatedCost: { '@type': 'MonetaryAmount', currency: 'EUR', value: '59' },
              step: STEPS.map(([name, text], i) => ({
                '@type': 'HowToStep',
                position: i + 1,
                name,
                text,
                url: `${URL}#etape-${i + 1}`,
              })),
            },
            {
              '@type': 'FAQPage',
              '@id': `${URL}#faq`,
              inLanguage: 'fr-FR',
              mainEntityOfPage: { '@id': WEBPAGE_ID },
              mainEntity: FAQ.map(([q, a]) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
              })),
            },
          ],
        },
      ],

    }),
  component: ParmenionLanding,
});
