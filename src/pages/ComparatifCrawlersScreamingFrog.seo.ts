import { breadcrumbList } from '@/lib/seo/breadcrumb';

export const FAQS = [
  {
    q: 'Quelle est la meilleure alternative à Screaming Frog en 2026 ?',
    a: "Si vous cherchez un crawler qui tourne en ligne, sans limite de 500 URL et qui livre un plan d'action plutôt que des tableaux brutes, Crawlers.fr couvre le besoin : crawl jusqu'à 10 000 URL avec rendu JavaScript, audit de 200 critères, architecture sémantique et visibilité dans les moteurs IA. Screaming Frog reste excellent pour l'inspection ponctuelle en local et les configurations très fines.",
  },
  {
    q: 'Existe-t-il un Screaming Frog en ligne et gratuit ?',
    a: "Screaming Frog est un logiciel de bureau : il n'existe pas de version web officielle, et la version gratuite plafonne à 500 URL par crawl. Crawlers.fr fonctionne dans le navigateur et offre deux rapports complets sans création de compte, puis 30 crédits par rapport.",
  },
  {
    q: 'Crawlers.fr remplace-t-il Screaming Frog ?',
    a: "Pour un audit technique complet, une architecture de site et un rapport client, oui. Pour des extractions XPath très spécifiques ou une inspection hors ligne d'un environnement de préproduction fermé, Screaming Frog garde l'avantage — les deux outils cohabitent bien dans une équipe SEO.",
  },
  {
    q: 'Ahrefs ou Screaming Frog pour crawler un site ?',
    a: "Screaming Frog est un logiciel de bureau dont le métier est le crawl ; la version gratuite plafonne à 500 URL. Ahrefs est une suite en ligne : le crawl y est un module (Site Audit), à côté des mots-clés et des backlinks. Les plafonds Ahrefs dépendent de l'offre et ne sont pas chiffrés ici. Crawlers.fr crawle depuis le serveur, sans installation, et ajoute un score GEO ainsi qu'une lecture de visibilité sur ChatGPT, Gemini, Perplexity et Claude.",
  },
  {
    q: 'Semrush ou Screaming Frog pour un crawl technique ?',
    a: "Screaming Frog s'installe sur le poste et explore le site en local. Le crawler Semrush est le robot du module Site Audit : il tourne dans le cloud de la suite, avec le user-agent public SemrushBot. Crawlers.fr est aussi un crawl hébergé, avec en plus un score GEO, une lecture des bots IA et, pour un WordPress connecté, une injection de correctif via le pont CMS.",
  },
  {
    q: 'Peut-on crawler un gros site sans saturer son ordinateur ?',
    a: "C'est la limite structurelle d'un crawler de bureau : au-delà de quelques dizaines de milliers d'URL, la mémoire du poste devient le facteur bloquant. Un crawl exécuté côté serveur supprime ce plafond et permet de lancer plusieurs audits en parallèle.",
  },
];

export const CANONICAL = 'https://crawlers.fr/comparatif-crawlers-screaming-frog';

export const SCREAMING_FROG_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Alternative à Screaming Frog : le crawl en ligne, sans limite de 500 URL',
    description:
      'Comparatif Crawlers.fr vs Screaming Frog sur 10 critères : crawl en ligne, limite gratuite, rendu JavaScript, architecture sémantique, visibilité IA et rapports client.',
    author: {
      '@type': 'Person',
      name: 'Adrien de Volontat',
      url: 'https://crawlers.fr/auteur/adrien-de-volontat',
    },
    publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
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
    ...breadcrumbList([
      { name: 'Accueil', url: 'https://crawlers.fr/' },
      { name: 'Comparatifs', url: 'https://crawlers.fr/comparatif-crawlers-semrush' },
      { name: 'Crawlers.fr vs Screaming Frog', url: CANONICAL },
    ]),
  },
];
