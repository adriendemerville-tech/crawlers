/**
 * Données SEO de /comparatif-crawlers-ahrefs, isolées du composant de page pour
 * que le head() de la route n'entraîne pas le composant dans le chunk critique.
 */
import { ORGANIZATION_REF } from '@/lib/seo/organization';

export const CANONICAL = 'https://crawlers.fr/comparatif-crawlers-ahrefs';

export const FAQS = [
  {
    q: 'Crawlers.fr remplace-t-il Ahrefs ?',
    a: "Sur le crawl technique, l'architecture sémantique et la visibilité dans les moteurs IA, oui. Sur l'index de backlinks brut, Ahrefs conserve la profondeur d'index la plus large du marché : Crawlers.fr s'appuie sur des données backlinks tierces et les qualifie (réseau propre, annuaires, éditorial tiers) plutôt que d'exposer un index maison.",
  },
  {
    q: 'Quelle est la différence de périmètre ?',
    a: "Ahrefs est un outil d'analyse : il constate. Crawlers.fr va du constat au correctif — plan d'action priorisé, génération du contenu ou du code, déploiement sur le CMS, puis contre-audit d'impact.",
  },
  {
    q: 'Crawlers.fr mesure-t-il la visibilité dans ChatGPT et Perplexity ?',
    a: "Oui : benchmarks multi-modèles, détection des citations, passages citables, JSON-LD et politique de crawl des agents IA. C'est le volet GEO, absent des suites SEO classiques.",
  },
  {
    q: 'Le tarif est-il comparable ?',
    a: "Crawlers.fr démarre à 29 €/mois tout inclus, sans surcoût par projet ni par utilisateur sur les offres agence. Le positionnement tarifaire est nettement sous celui des suites américaines.",
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
