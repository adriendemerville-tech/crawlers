import { createFileRoute } from '@tanstack/react-router';
import CollabInstagramLanding from '@/pages/CollabInstagramLanding';
import { COLLAB_INSTAGRAM_FAQ } from '@/pages/CollabInstagramLanding.faq';
import { pageHead, SITE_URL } from '@/lib/seo/pageHead';
import { ORGANIZATION_REF } from '@/lib/seo/organization';

const URL = `${SITE_URL}/collab-instagram`;

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Collaborations Instagram Crawlers.fr',
    serviceType: 'Échange et achat de collaborations Instagram à prix déterministe',
    url: URL,
    description:
      'Place d’échange de collaborations Instagram où le prix, la durée d’engagement et la mention de partenariat sont calculés à partir de signaux mesurés, avec vérification de diffusion et commission de 15 %.',
    areaServed: 'FR',
    provider: ORGANIZATION_REF,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: COLLAB_INSTAGRAM_FAQ.map((item) => ({
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
      { '@type': 'ListItem', position: 3, name: 'Collaborations Instagram', item: URL },
    ],
  },
];

export const Route = createFileRoute('/collab-instagram')({
  head: () =>
    pageHead({
      title: 'Collaborations Instagram — prix déterministe',
      description:
        'Échangez story et publication Instagram à un prix calculé : audience mesurée, mention de partenariat obligatoire, diffusion vérifiée et troc possible contre un backlink.',
      path: '/collab-instagram',
      keywords:
        'collaboration Instagram, story sponsorisée, échange de visibilité, influence marketing, place d’échange',
      jsonLd,
    }),
  component: CollabInstagramLanding,
});
