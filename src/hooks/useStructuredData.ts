import { useEffect } from 'react';

/**
 * Injects JSON-LD structured data into the document head.
 * Moved from inline HTML to dynamic injection to reduce critical HTML payload size
 * and shorten the critical request chain for better LCP.
 */
export function useStructuredData() {
  useEffect(() => {
    const schemas: Array<{ id: string; data: object }> = [
      {
        id: 'software-application',
        data: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Crawlers.fr - Audit SEO & GEO Expert",
          "alternateName": ["Audit Technique SEO Gratuit", "Score GEO IA", "Analyse LLM Marketing"],
          "description": "Audit technique SEO expert gratuit et rapide sur 200 points. Score GEO pour ChatGPT, Google Gemini et LLM. Référencement IA pour moteurs de recherche. Analyse marketing instantanée.",
          "url": "https://crawlers.fr",
          "applicationCategory": "BusinessApplication",
          "applicationSubCategory": "SEO Tool",
          "operatingSystem": "Web",
          "browserRequirements": "Requires JavaScript",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
            "priceValidUntil": "2026-12-31"
          },
          "featureList": [
            "Audit technique SEO sur 200 points",
            "Score GEO pour moteurs génératifs (ChatGPT, Gemini, Perplexity)",
            "Analyse des bots IA (GPTBot, ClaudeBot, Google-Extended)",
            "Analyse PageSpeed Insights avec Core Web Vitals",
            "Référencement expert gratuit et rapide",
            "Analyse marketing pour LLM et IA",
            "Vérification des données structurées JSON-LD",
            "Recommandations SEO et GEO personnalisées"
          ],
          "screenshot": "https://crawlers.fr/og-image.png",
          "inLanguage": ["fr", "en", "es"],
          "isAccessibleForFree": true,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "1250",
            "bestRating": "5"
          }
        }
      },
      {
        id: 'organization',
        data: {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Crawlers.fr",
          "alternateName": "Audit SEO & GEO Expert",
          "url": "https://crawlers.fr",
          "logo": {
            "@type": "ImageObject",
            "url": "https://crawlers.fr/favicon.svg",
            "contentUrl": "https://crawlers.fr/favicon.svg",
            "width": 512,
            "height": 512,
            "encodingFormat": "image/svg+xml"
          },
          "image": "https://crawlers.fr/og-image.png",
          "description": "Plateforme experte d'audit technique SEO et GEO pour IA, ChatGPT, Google Gemini et moteurs de recherche. Référencement rapide et gratuit.",
          "areaServed": ["France", "Europe", "North America", "South America"],
          "sameAs": []
        }
      },
      {
        id: 'breadcrumb',
        data: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Accueil - Audit SEO & GEO Expert",
              "item": "https://crawlers.fr/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Score SEO 200 - Audit Technique",
              "item": "https://crawlers.fr/audit-expert"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "Lexique SEO, GEO & IA",
              "item": "https://crawlers.fr/lexique"
            }
          ]
        }
      }
    ];

    // Inject all schemas
    schemas.forEach(({ id, data }) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-schema', id);
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      schemas.forEach(({ id }) => {
        document.querySelectorAll(`script[data-schema="${id}"]`).forEach(el => el.remove());
      });
    };
  }, []);
}
