/**
 * Données SEO de /comparatif-crawlers-ahrefs, isolées du composant de page pour
 * que le head() de la route n'entraîne pas le composant dans le chunk critique.
 */
import { ORGANIZATION_REF } from '@/lib/seo/organization';

export const CANONICAL = 'https://crawlers.fr/comparatif-crawlers-ahrefs';

export const FAQS = [
  {
    q: 'Quelle est la meilleure alternative à Ahrefs en 2026 ?',
    a: "Cela dépend de l'usage. Pour la prospection de backlinks à grande échelle, l'index propriétaire d'Ahrefs reste difficile à remplacer. Pour l'audit technique, l'architecture sémantique et la visibilité dans les moteurs IA, Crawlers.fr couvre le besoin avec un audit complet gratuit et un plan d'action priorisé.",
  },
  {
    q: 'Crawlers.fr remplace-t-il Ahrefs ?',
    a: "Sur le crawl, l'architecture et le GEO, oui. Sur l'exploration d'un index de liens de plusieurs milliards d'URL, non : les deux outils sont complémentaires. Beaucoup d'équipes gardent Ahrefs pour le netlinking et pilotent le SEO technique et la visibilité IA avec Crawlers.fr.",
  },
  {
    q: 'Ahrefs mesure-t-il la citation par ChatGPT ?',
    a: "Ahrefs a ajouté un suivi des mentions dans les réponses IA, mais il n'interroge pas les modèles avec un jeu de questions calibré sur votre marché. Crawlers.fr pose 9 questions rédigées à partir de la carte d'identité du site, réparties en découverte, comparaison et contexte, et mesure la citation réelle.",
  },
  {
    q: 'Peut-on tester sans carte bancaire ?',
    a: 'Oui. Deux rapports complets sont offerts sans compte sur Marina, puis chaque rapport coûte 30 crédits.',
  },
];


export const AHREFS_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Alternative à Ahrefs : Crawlers.fr vs Ahrefs, 8 critères de décision',
    description:
      'Comparatif Crawlers.fr vs Ahrefs : backlinks, crawl technique, architecture sémantique, visibilité dans les moteurs IA, tarifs et marque blanche.',
    author: {
      '@type': 'Person',
      name: 'Adrien de Volontat',
      url: 'https://crawlers.fr/auteur/adrien-de-volontat',
    },
    publisher: ORGANIZATION_REF,
    mainEntityOfPage: CANONICAL,
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
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Comparatifs',
        item: 'https://crawlers.fr/comparatif-crawlers-semrush',
      },
      { '@type': 'ListItem', position: 3, name: 'Crawlers.fr vs Ahrefs', item: CANONICAL },
    ],
  },
];
