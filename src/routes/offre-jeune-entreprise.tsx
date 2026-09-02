import { createFileRoute } from '@tanstack/react-router';
import OffreJeuneEntreprise, { FAQ_ITEMS } from '@/pages/OffreJeuneEntreprise';
import { pageHead, SITE_URL } from '@/lib/seo/pageHead';
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo/articleSchema';
import { STARTUP_TRIAL_OFFER } from '@/lib/seo/startupTrialOffer';

const PATH = '/offre-jeune-entreprise';
const DESCRIPTION =
  'Entreprises et freelances immatriculés depuis moins de 12 mois : plan Pro Agency Crawlers.fr offert un an (audit SEO, GEO, crawl), sans carte bancaire.';

export const Route = createFileRoute('/offre-jeune-entreprise')({
  head: () =>
    pageHead({
      title: 'Outil SEO et GEO gratuit 12 mois — Jeunes entreprises',
      description: DESCRIPTION,
      path: PATH,
      ogType: 'product',
      keywords:
        'outil SEO gratuit jeune entreprise, logiciel SEO gratuit startup, offre création entreprise SEO, GEO gratuit 12 mois',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Crawlers.fr Pro Agency — Offre jeune entreprise',
          description: DESCRIPTION,
          brand: { '@type': 'Brand', name: 'Crawlers.fr' },
          url: `${SITE_URL}${PATH}`,
          offers: [{ ...STARTUP_TRIAL_OFFER, url: `${SITE_URL}${PATH}` }],
        },
        buildBreadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Tarifs', path: '/tarifs' },
          { name: 'Offre jeune entreprise', path: PATH },
        ]),
        buildFaqJsonLd(FAQ_ITEMS),
      ],
    }),
  component: OffreJeuneEntreprise,
});
