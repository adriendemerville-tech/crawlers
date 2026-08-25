/**
 * Données SEO de /comparatif-plateforme-seo-ia, isolées du composant de page.
 * La route importe uniquement ce module dans son head(), ce qui évite de tirer
 * le composant (et framer-motion / lucide) dans le chunk critique partagé.
 */
import { ORGANIZATION_REF, SITE_URL_CANONICAL as SITE_URL } from '@/lib/seo/organization';

export const faqItems = [
  {
    q: "Pourquoi ne pas simplement utiliser Claude Code pour le SEO ?",
    a: "Claude Code est un excellent outil de développement, mais il ne dispose d'aucune donnée SEO réelle. Il déduit, estime et parfois hallucine. Crawlers crawle réellement vos pages, se connecte à vos données GSC/GA4, et croise ces informations avec les données de milliers d'autres sites pour des diagnostics fiables.",
  },
  {
    q: "OpenAI avec des plugins peut-il remplacer Crawlers ?",
    a: "Les plugins OpenAI offrent des connexions ponctuelles, mais aucune historisation ni croisement de données. Crawlers stocke chaque métrique dans le temps, détecte les anomalies automatiquement, et alimente des algorithmes prédictifs que les plugins ne peuvent pas reproduire.",
  },
  {
    q: "Qu'est-ce que le « croisement de données » apporte concrètement ?",
    a: "Exemple concret : Crawlers peut corréler une baisse de trafic GA4 avec un changement de crawl budget détecté dans les logs serveur, confirmé par une chute de position GSC, et proposer un correctif technique automatique. Un agent IA isolé ne peut pas connecter ces signaux.",
  },
  {
    q: "Crawlers utilise-t-il aussi l'IA ?",
    a: "Oui — Crawlers intègre 16+ modèles IA (Gemini, Claude, Mistral) mais les utilise sur des données réelles, pas en remplacement de données. L'IA est un accélérateur de traitement, pas la source de vérité.",
  },
  {
    q: "Puis-je utiliser Crawlers ET Claude ensemble ?",
    a: "Absolument. Crawlers expose un serveur MCP qui permet à Claude d'interroger vos données SEO réelles. C'est la combinaison optimale : l'intelligence de Claude + les données fiables de Crawlers.",
  },
];

const articleSD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Crawlers vs Claude Agent vs OpenAI : pourquoi une plateforme SEO/GEO dédiée fait la différence",
  "description": "Comparatif détaillé entre les agents IA généralistes (Claude, ChatGPT) et Crawlers.fr, plateforme spécialisée SEO/GEO avec données croisées et mutualisées.",
  "author": { "@type": "Person", "name": "Adrien de Volontat", "url": `${SITE_URL}/a-propos` },
  "publisher": ORGANIZATION_REF,
  "datePublished": "2026-04-10",
  "dateModified": "2026-04-10",
  "wordCount": 5000,
  "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/comparatif-plateforme-seo-ia` },
};

const breadcrumbSD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL },
    { "@type": "ListItem", "position": 2, "name": "Plateforme vs Agents IA", "item": `${SITE_URL}/comparatif-plateforme-seo-ia` },
  ],
};

const faqSD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map((f) => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a },
  })),
};

/** JSON-LD servi côté serveur par le head() de la route. */
export const PLATEFORME_JSONLD = [articleSD, breadcrumbSD, faqSD];
