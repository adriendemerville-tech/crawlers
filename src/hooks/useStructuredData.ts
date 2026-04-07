import { useEffect } from 'react';

/**
 * Injects global JSON-LD structured data (SoftwareApplication + Organization)
 * into the document head. Runs once on homepage mount.
 */
export function useStructuredData() {
  useEffect(() => {
    const schemas: Array<{ id: string; data: object }> = [
      {
        id: 'software-application',
        data: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Crawlers.fr",
          "alternateName": "Crawlers",
          "applicationCategory": "SEO & GEO Audit Tool",
          "abstract": "Premier outil francophone combinant audit SEO technique, GEO Score, visibilité LLM et génération de correctifs actionnables.",
          "description": "Crawlers.fr est une plateforme SaaS française lancée en mars 2026. Premier outil francophone à couvrir simultanément le SEO technique, le GEO (Generative Engine Optimization), l'AEO (Answer Engine Optimization) et l'E-E-A-T. 7 algorithmes propriétaires en production. Architecture serverless avec multi-fallback sur toutes les APIs critiques. Hébergement européen, RGPD natif.",
          "url": "https://crawlers.fr",
          "sameAs": [
            "https://crawlers.fr/a-propos",
            "https://crawlers.fr/methodologie"
          ],
          "offers": {
            "@type": "Offer",
            "price": "29",
            "priceCurrency": "EUR",
            "description": "Pro Agency — offre de lancement garantie à vie pour les 100 premiers abonnés. Prochain palier : 99€/mois.",
            "availability": "https://schema.org/LimitedAvailability"
          },
          "featureList": [
            "Audit SEO technique 200 points",
            "GEO Score visibilité moteurs IA",
            "Visibilité LLM multi-modèles (ChatGPT, Perplexity, Gemini, Claude)",
            "Benchmark LLM parallèle multi-modèles",
            "Profondeur LLM analyse conversationnelle 5 tours",
            "Diagnostic de hallucination",
            "Cocon sémantique 3D (Three.js, TF-IDF)",
            "Score IAS Indice d'Alignement Stratégique 23 variables",
            "Audit Stratégique IA scoring multi-axes",
            "Audit Comparé benchmark vs 3 concurrents",
            "Audit Local SEO Google My Business Pack Local",
            "Matrice d'audit sur-mesure multi-critères",
            "Tracking SERP hebdomadaire positions Google",
            "Historique Google Search Console",
            "Historique Google Analytics 4",
            "Suivi backlinks referring domains",
            "Part de Voix SEO score pondéré multi-canaux",
            "Prédiction de trafic Triangle Prédictif MAPE < 15%",
            "Architecte Génératif code correctif multi-pages",
            "Crawl multi-pages sitemap-first jusqu'à 5000 pages",
            "Scanner WordPress plugins thèmes sécurité",
            "Injection de scripts via SDK et GTM",
            "Agent SEO autonome optimisation contenu",
            "Agent CTO maintenance algorithmique automatique"
          ],
          "operatingSystem": "Web",
          "inLanguage": ["fr", "en", "es"],
          "datePublished": "2026-03-18",
          "audience": {
            "@type": "Audience",
            "audienceType": "Agences SEO, Freelances SEO, PME e-commerce, Startups SaaS"
          },
          "creator": {
            "@type": "Organization",
            "name": "Crawlers.fr",
            "url": "https://crawlers.fr"
          },
          "potentialAction": {
            "@type": "UseAction",
            "target": "https://crawlers.fr/audit-expert"
          }
        }
      },
      {
        id: 'organization',
        data: {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Crawlers.fr",
          "url": "https://crawlers.fr",
          "logo": "https://crawlers.fr/favicon.svg",
          "foundingDate": "2026",
          "founder": {
            "@type": "Person",
            "name": "Adrien de Volontat",
            "jobTitle": "Fondateur & CTO",
            "url": "https://crawlers.fr/a-propos",
            "sameAs": [
              "https://www.linkedin.com/in/adrien-de-volontat/"
            ]
          },
          "description": "Éditeur de la plateforme d'audit SEO, GEO et visibilité IA Crawlers.fr. Premier outil francophone couvrant simultanément SEO technique, GEO Score, visibilité LLM et génération de correctifs actionnables.",
          "areaServed": ["FR", "BE", "CH", "CA"],
          "knowsAbout": [
            "SEO technique",
            "Generative Engine Optimization",
            "Answer Engine Optimization",
            "Visibilité LLM",
            "Cocon sémantique",
            "Audit SEO",
            "GEO Score",
            "E-E-A-T"
          ],
          "sameAs": [
            "https://www.linkedin.com/company/crawlers-fr/",
            "https://crawlers.fr/a-propos",
            "https://crawlers.fr/methodologie"
          ]
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
      },
      {
        id: 'cocoon-webpage',
        data: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Cocoon — Architecture Sémantique Vivante",
          "description": "Visualisez l'architecture sémantique de votre site comme un organisme vivant. Algorithme Anti-Wiki, ROI prédictif, Score GEO et Citabilité LLM par page.",
          "url": "https://crawlers.fr/cocoon",
          "isPartOf": { "@type": "WebSite", "url": "https://crawlers.fr" },
          "about": {
            "@type": "SoftwareApplication",
            "name": "Cocoon - Organisme Sémantique",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web"
          }
        }
      },
      {
        id: 'features-cocoon-webpage',
        data: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Cocoon — Module d'Architecture Sémantique | Crawlers.fr",
          "description": "Découvrez le module Cocoon : visualisation 3D du maillage sémantique, algorithme Anti-Wiki (Iab), ROI prédictif et score de citabilité LLM pour chaque page.",
          "url": "https://crawlers.fr/features/cocoon",
          "isPartOf": { "@type": "WebSite", "url": "https://crawlers.fr" }
        }
      }
    ];

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
