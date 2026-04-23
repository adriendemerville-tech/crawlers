import { useEffect } from 'react';

/**
 * Injects a consolidated @graph Knowledge Graph JSON-LD into <head>.
 * Covers Organization, Person/Founder, SoftwareApplication, FAQPage,
 * ItemList (audiences), TechArticle (stack), Dataset (KPIs).
 * Runs once on homepage mount.
 */
export function useStructuredData() {
  useEffect(() => {
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        // ─── Organization ───────────────────────────────
        {
          "@type": "Organization",
          "@id": "https://crawlers.fr/#organization",
          "name": "Crawlers.fr",
          "url": "https://crawlers.fr",
          "logo": {
            "@type": "ImageObject",
            "url": "https://crawlers.fr/favicon.svg",
            "width": 512,
            "height": 512
          },
          "foundingDate": "2026-03-18",
          "founder": { "@id": "https://crawlers.fr/#founder" },
          "description": "Editeur de la plateforme d'audit SEO, GEO et visibilite IA Crawlers.fr. Premier outil francophone couvrant simultanement SEO technique, GEO Score, visibilite LLM et generation de correctifs actionnables.",
          "areaServed": ["FR", "BE", "CH", "CA", "LU", "MC"],
          "knowsAbout": [
            "SEO technique", "Generative Engine Optimization", "Answer Engine Optimization",
            "Visibilite LLM", "Cocon semantique", "E-E-A-T", "GEO Score",
            "Google Business Profile", "Core Web Vitals", "Machine Learning predictif"
          ],
          "sameAs": [
            "https://www.linkedin.com/company/crawlers-fr/",
            "https://crawlers.fr/a-propos",
            "https://crawlers.fr/methodologie"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "email": "contact@crawlers.fr",
            "contactType": "customer service",
            "availableLanguage": ["French", "English", "Spanish"]
          }
        },

        // ─── Founder / Person ───────────────────────────
        {
          "@type": "Person",
          "@id": "https://crawlers.fr/#founder",
          "name": "Adrien de Volontat",
          "jobTitle": "Fondateur & CTO",
          "url": "https://crawlers.fr/a-propos",
          "worksFor": { "@id": "https://crawlers.fr/#organization" },
          "knowsAbout": ["SEO", "GEO", "Machine Learning", "TypeScript", "Deno", "React"],
          "sameAs": ["https://www.linkedin.com/in/adrien-de-volontat/"]
        },

        // ─── SoftwareApplication ────────────────────────
        {
          "@type": "SoftwareApplication",
          "@id": "https://crawlers.fr/#software",
          "name": "Crawlers.fr",
          "alternateName": "Crawlers",
          "applicationCategory": "BusinessApplication",
          "applicationSubCategory": "SEO & GEO Audit Tool",
          "operatingSystem": "Web",
          "inLanguage": ["fr", "en", "es"],
          "datePublished": "2026-03-18",
          "url": "https://crawlers.fr",
          "creator": { "@id": "https://crawlers.fr/#organization" },
          "description": "Plateforme SaaS d'audit SEO, GEO et visibilite IA. 7 algorithmes proprietaires, architecture serverless, hebergement europeen, RGPD natif.",
          "offers": [
            {
              "@type": "Offer",
              "name": "Gratuit",
              "price": "0",
              "priceCurrency": "EUR",
              "description": "Audit SEO technique, Score GEO, Crawlability IA, PageSpeed — sans inscription.",
              "availability": "https://schema.org/InStock"
            },
            {
              "@type": "Offer",
              "name": "Pro Agency",
              "price": "29",
              "priceCurrency": "EUR",
              "priceValidUntil": "2026-12-31",
              "description": "Offre de lancement garantie a vie pour les 100 premiers abonnes. Console multi-sites, tous les outils Pro.",
              "availability": "https://schema.org/LimitedAvailability"
            },
            {
              "@type": "Offer",
              "name": "Pro Agency+",
              "price": "99",
              "priceCurrency": "EUR",
              "description": "50 000 pages crawl/mois, 3 comptes, support prioritaire.",
              "availability": "https://schema.org/InStock"
            }
          ],
          "featureList": [
            "Audit SEO technique 200+ points",
            "GEO Score visibilite moteurs IA",
            "Visibilite LLM multi-modeles (ChatGPT, Perplexity, Gemini, Claude)",
            "Benchmark LLM parallele multi-modeles",
            "Cocon semantique 3D (Three.js, TF-IDF)",
            "Score IAS Indice d'Alignement Strategique",
            "Audit Strategique IA scoring multi-axes",
            "Audit Compare benchmark vs 3 concurrents",
            "Audit Local SEO Google My Business",
            "Matrice d'audit sur-mesure multi-criteres",
            "Tracking SERP hebdomadaire",
            "Architecte Generatif code correctif multi-pages",
            "Crawl multi-pages sitemap-first jusqu'a 50 000 pages",
            "Agent SEO autonome optimisation contenu",
            "Autopilote Parmenion maintenance predictive ML",
            "Connexion CMS directe (WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo)"
          ],
          "audience": { "@id": "https://crawlers.fr/#audiences" },
          "potentialAction": {
            "@type": "UseAction",
            "target": "https://crawlers.fr/audit-expert"
          }
        },

        // ─── ItemList: Target Audiences ─────────────────
        {
          "@type": "ItemList",
          "@id": "https://crawlers.fr/#audiences",
          "name": "Audiences cibles de Crawlers.fr",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Agences SEO", "description": "Audit multi-clients, rapports personnalises, gestion collaborative." },
            { "@type": "ListItem", "position": 2, "name": "Freelances SEO / Consultants", "description": "Outils d'analyse avances, prospection Marina, generation de contenu IA." },
            { "@type": "ListItem", "position": 3, "name": "PME e-commerce", "description": "Optimisation fiche produit, audit local, connexion CMS directe." },
            { "@type": "ListItem", "position": 4, "name": "Startups SaaS", "description": "GEO Score, visibilite LLM, positionnement moteurs IA." },
            { "@type": "ListItem", "position": 5, "name": "Directions Marketing", "description": "Dashboards KPI, Integration GA4/GSC, rapports automatises." }
          ]
        },

        // ─── TechArticle: Technology Stack ───────────────
        {
          "@type": "TechArticle",
          "@id": "https://crawlers.fr/#techstack",
          "headline": "Architecture technique de Crawlers.fr",
          "description": "Stack technologique de la plateforme : React 18, TypeScript 5, Supabase Edge Functions (Deno), PostgreSQL, Three.js, TailwindCSS.",
          "about": { "@id": "https://crawlers.fr/#software" },
          "proficiencyLevel": "Expert",
          "dependencies": "React 18, TypeScript 5, Vite 5, TailwindCSS 3, Supabase, Deno, PostgreSQL, Three.js, Recharts, Framer Motion",
          "programmingLanguage": ["TypeScript", "SQL", "JavaScript"],
          "url": "https://crawlers.fr/methodologie"
        },

        // ─── Dataset: Platform KPIs ─────────────────────
        {
          "@type": "Dataset",
          "@id": "https://crawlers.fr/#kpis",
          "name": "KPIs plateforme Crawlers.fr",
          "description": "Metriques cles de performance de la plateforme d'audit SEO/GEO Crawlers.fr.",
          "creator": { "@id": "https://crawlers.fr/#organization" },
          "variableMeasured": [
            { "@type": "PropertyValue", "name": "Points d'audit SEO", "value": "200+", "unitText": "criteres" },
            { "@type": "PropertyValue", "name": "Modeles LLM supportes", "value": "6", "unitText": "modeles" },
            { "@type": "PropertyValue", "name": "CMS supportes", "value": "7", "unitText": "plateformes" },
            { "@type": "PropertyValue", "name": "Pages crawlables max", "value": "50000", "unitText": "pages/mois" },
            { "@type": "PropertyValue", "name": "Algorithmes proprietaires", "value": "7", "unitText": "algorithmes" },
            { "@type": "PropertyValue", "name": "Langues supportees", "value": "3", "unitText": "langues" },
            { "@type": "PropertyValue", "name": "Precision prediction trafic (MAPE)", "value": "<15%", "unitText": "pourcentage" }
          ]
        },

        // ─── FAQPage ────────────────────────────────────
        {
          "@type": "FAQPage",
          "@id": "https://crawlers.fr/#faq",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Qu'est-ce que Crawlers.fr ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crawlers.fr est une plateforme SaaS francaise d'audit SEO, GEO et visibilite IA. Elle permet d'analyser et d'optimiser la presence d'un site web sur Google et sur les moteurs de recherche generatifs (ChatGPT, Gemini, Perplexity, Claude)."
              }
            },
            {
              "@type": "Question",
              "name": "Qu'est-ce que le GEO Score ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Le GEO Score (Generative Engine Optimization Score) mesure la capacite d'un site a etre cite par les moteurs de recherche IA. Il analyse la structure des donnees, les signaux E-E-A-T et la citabilite du contenu pour les LLM."
              }
            },
            {
              "@type": "Question",
              "name": "Crawlers.fr est-il gratuit ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Oui, les outils de base (Audit SEO technique, Score GEO, Crawlability IA, PageSpeed) sont gratuits et sans inscription. Les fonctionnalites avancees (Console multi-sites, Cocoon 3D, Autopilote, CMS direct) sont disponibles a partir de 29EUR/mois."
              }
            },
            {
              "@type": "Question",
              "name": "Quels CMS sont supportes ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crawlers.fr supporte 7 CMS en connexion directe : WordPress, Shopify, Wix, PrestaShop, Drupal, Odoo et Webflow. Les corrections sont deployees automatiquement via les APIs natives de chaque plateforme."
              }
            },
            {
              "@type": "Question",
              "name": "Comment fonctionne l'Autopilote Parmenion ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "L'Autopilote Parmenion est un systeme de maintenance predictive par machine learning. Il analyse automatiquement les signaux SEO/GEO du site et genere 2 a 10 actions correctives par cycle, deployees directement via le CMS connecte."
              }
            }
          ]
        },

        // ─── WebSite (SearchAction) ─────────────────────
        {
          "@type": "WebSite",
          "@id": "https://crawlers.fr/#website",
          "name": "Crawlers.fr",
          "url": "https://crawlers.fr",
          "publisher": { "@id": "https://crawlers.fr/#organization" },
          "inLanguage": ["fr", "en", "es"],
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://crawlers.fr/?url={search_term_string}"
            },
            "query-input": "required name=search_term_string"
          }
        }
      ]
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'knowledge-graph');
    script.textContent = JSON.stringify(graph);
    document.head.appendChild(script);

    return () => {
      document.querySelectorAll('script[data-schema="knowledge-graph"]').forEach(el => el.remove());
    };
  }, []);
}
