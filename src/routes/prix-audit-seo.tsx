import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { pageHead, DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo/pageHead';
import { ORGANIZATION_REF } from '@/lib/seo/organization';

const PrixAuditSeo = lazy(() => import('@/pages/PrixAuditSeo'));

const URL = 'https://crawlers.fr/prix-audit-seo';
const WEBPAGE_ID = `${URL}#webpage`;

const FAQ: Array<[string, string]> = [
  [
    'Combien coûte un audit SEO en agence ?',
    'Pour un site de TPE/PME, un audit suivi de la mise en œuvre (contenus, correctifs, fiche Google Maps) est généralement facturé entre 1 400 € et 2 700 €, sur un délai de 2 à 6 semaines. Il s\'agit d\'une estimation : chaque agence établit son propre devis.',
  ],
  [
    'Pourquoi la passe Crawlers ne coûte-t-elle que 59 € ?',
    'Parce que le crawl, la mesure GEO, la priorisation des correctifs et la rédaction des brouillons sont automatisés. Vous payez le résultat, pas les heures de production.',
  ],
  [
    'Un audit gratuit suffit-il ?',
    'Un audit gratuit identifie les problèmes mais ne les corrige pas. La passe unique inclut l\'audit, 3 contenus rédigés, les correctifs déployés après votre validation et l\'optimisation de votre fiche Google Maps.',
  ],
  [
    'Y a-t-il un abonnement ou des frais cachés ?',
    'Non. La passe unique est un paiement de 59 € TTC, sans abonnement. Vous êtes remboursé intégralement tant qu\'aucun correctif n\'a été déployé sur votre site.',
  ],
  [
    'Quelle est la différence entre un audit SEO et un audit GEO ?',
    'L\'audit SEO mesure votre visibilité sur Google (balises, contenu, vitesse, maillage). L\'audit GEO mesure en plus votre citabilité par les moteurs IA comme ChatGPT ou Perplexity : passages citables, données structurées, présence dans leurs réponses. La passe Crawlers couvre les deux.',
  ],
  [
    'Combien coûte un audit GEO seul ?',
    'Quand une agence le facture séparément, le supplément observé se situe entre 500 € et 1 500 €. Chez Crawlers, la mesure de visibilité dans les réponses IA est incluse dans la passe unique à 59 € TTC, sans supplément.',
  ],
  [
    'Quel est le tarif d\'un audit SEO chez un freelance ?',
    'Un freelance SEO facture généralement entre 600 € et 1 500 € pour un audit détaillé d\'un site de TPE/PME. La mise en œuvre des correctifs est le plus souvent facturée séparément, au temps passé.',
  ],
];


export const Route = createFileRoute('/prix-audit-seo')({
  head: () =>
    pageHead({
      title: 'Prix d\'un audit SEO et GEO en 2026 : tarifs réels et comparatif',
      description:
        'Combien coûte un audit SEO ? Agence : 1 400 à 2 700 € estimés. Passe Crawlers : 59 € TTC avec audit, 3 contenus et fiche Google Maps. Comparatif détaillé.',
      path: '/prix-audit-seo',
      keywords:
        'prix audit seo, tarif audit seo, combien coûte un audit seo, prix audit geo, coût audit référencement',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': WEBPAGE_ID,
              url: URL,
              name: 'Prix d\'un audit SEO et GEO en 2026 : tarifs réels et comparatif',
              description:
                'Combien coûte un audit SEO ? Comparatif des tarifs agence (1 400–2 700 € estimés) et de la passe unique Crawlers à 59 € TTC.',
              inLanguage: 'fr-FR',
              isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Crawlers.fr' },
              publisher: ORGANIZATION_REF,
              primaryImageOfPage: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
              breadcrumb: { '@id': `${URL}#breadcrumb` },
              significantLink: [`${SITE_URL}/audit-geo-seo`, `${SITE_URL}/tarifs`],
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
                { '@type': 'ListItem', position: 2, name: 'Audit GEO SEO', item: { '@type': 'Thing', '@id': `${SITE_URL}/audit-geo-seo`, name: 'Audit GEO SEO' } },
                { '@type': 'ListItem', position: 3, name: 'Prix d\'un audit SEO', item: { '@type': 'Thing', '@id': URL, name: 'Prix d\'un audit SEO' } },
              ],
            },
            {
              '@type': 'Article',
              '@id': `${URL}#article`,
              headline: 'Prix d\'un audit SEO et GEO en 2026 : tarifs réels et comparatif',
              description:
                'Facteurs qui déterminent le prix d\'un audit SEO, comparatif agence vs solution automatisée, et contenu de la passe unique Crawlers à 59 € TTC.',
              inLanguage: 'fr-FR',
              author: ORGANIZATION_REF,
              publisher: ORGANIZATION_REF,
              image: DEFAULT_OG_IMAGE,
              mainEntityOfPage: { '@id': WEBPAGE_ID },
              about: [
                { '@type': 'Thing', name: 'Prix d\'un audit SEO' },
                { '@type': 'Thing', name: 'Audit GEO' },
              ],
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
  component: PrixAuditSeo,
});
