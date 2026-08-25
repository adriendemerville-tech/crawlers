/**
 * Données SEO de /crawl, isolées du composant de page : la route n'importe que
 * ce module dans son head(), le composant reste dans son chunk différé.
 */
import { ORGANIZATION_REF } from '@/lib/seo/organization';

export const CANONICAL = 'https://crawlers.fr/crawl';

export const FAQS = [
  {
    q: 'Comment crawler un site web complet ?',
    a: "Entrez le domaine dans l'outil de crawl, choisissez la profondeur et lancez l'analyse. Crawlers.fr découvre les URL via le sitemap puis par parcours des liens, jusqu'à 10 000 pages, et renvoie un rapport technique par URL avec plan d'action priorisé.",
  },
  {
    q: 'Peut-on crawler un site WordPress ?',
    a: "Oui, sans plugin. Le crawl fonctionne sur le HTML servi, donc sur WordPress comme sur Webflow, Shopify, Wix ou un site sur mesure. Pour WordPress, le rapport ajoute les contrôles propres au CMS : pages d'archives indexables, pagination, catégories vides, doublons tag/catégorie.",
  },
  {
    q: 'Quelle est la différence avec un site crawler classique type Screaming Frog ?',
    a: "Un crawler classique s'arrête au constat technique. Crawlers.fr ajoute la couche architecture (profondeur, orphelines, cannibalisation) et la couche GEO (citabilité par les moteurs IA), puis produit un plan d'action priorisé plutôt qu'un tableau brut. Le crawl est hébergé, donc rien à installer.",
  },
  {
    q: 'Le crawl est-il gratuit ?',
    a: "L'analyse d'une page est gratuite et sans inscription. Le crawl multi-pages est inclus dans les offres avec compte ; les volumes élevés (jusqu'à 10 000 URL) relèvent des offres Premium et agence.",
  },
  {
    q: 'À quelle fréquence recrawler un site ?',
    a: 'Un crawl complet toutes les deux semaines et un crawl ciblé par répertoire tous les cinq jours suffisent pour la plupart des sites. Crawlers.fr planifie ces passages automatiquement pour les sites suivis.',
  },
];


export const OUTIL_CRAWL_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Crawlers.fr — Outil de crawl de site web',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: CANONICAL,
    description:
      'Site crawler hébergé : analyse technique, architecture et citabilité IA jusqu’à 10 000 URL par site.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: ORGANIZATION_REF,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://crawlers.fr/' },
      { '@type': 'ListItem', position: 2, name: 'Outil de crawl', item: CANONICAL },
    ],
  },
];
