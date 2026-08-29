/**
 * JSON-LD structuré de la page /app/ranking-serp.
 * Émis côté serveur via head() (src/routes/app/ranking-serp.tsx) pour être
 * présent dans le HTML initial lu par Google et les agents IA.
 */
export const rankingSerpJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Benchmark Rank SERP — Crawlers.fr",
      "applicationCategory": "SEO Tool",
      "operatingSystem": "Web",
      "description": "Outil gratuit de benchmark SERP multi-providers. Comparez les positions Google renvoyées par DataForSEO, SerpApi, Serper et Bright Data pour fiabiliser votre suivi SEO.",
      "url": "https://crawlers.fr/app/ranking-serp",
      "author": { "@type": "Organization", "name": "Crawlers.fr", "url": "https://crawlers.fr" },
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Pourquoi croiser plusieurs sources SERP ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Chaque API SERP (DataForSEO, SerpApi, Serper, Bright Data) interroge Google depuis des datacenter différents. Les positions varient selon la localisation, le user-agent et les mesures anti-scraping. Le croisement multi-providers neutralise ces biais et donne un classement statistiquement fiable."
          }
        },
        {
          "@type": "Question",
          "name": "Qu'est-ce que la pénalité single-hit ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Si un site n'est trouvé que par un seul provider sur trois, sa position moyenne est pénalisée de +20 points. Cela réduit les faux positifs causés par les résultats personnalisés ou les techniques anti-scraping de Google."
          }
        },
        {
          "@type": "Question",
          "name": "Est-ce que cet outil est gratuit ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Oui, le benchmark SERP est accessible gratuitement à tous les utilisateurs, inscrits ou non. Les utilisateurs connectés bénéficient en plus de la sauvegarde et de l'historique de leurs benchmarks."
          }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
        { "@type": "ListItem", "position": 2, "name": "Benchmark Rank SERP", "item": "https://crawlers.fr/app/ranking-serp" }
      ]
    }
  ]
};
