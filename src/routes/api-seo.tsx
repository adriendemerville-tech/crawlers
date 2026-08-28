import { createFileRoute } from "@tanstack/react-router";
import ApiSeoPage from "@/pages/ApiSeo";
import { pageHead } from "@/lib/seo/pageHead";
import { buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";

const SITE_URL = "https://crawlers.fr";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Qu’est-ce qu’une API SEO ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Une API SEO permet de déclencher des analyses de référencement (crawl, positions, audit technique, visibilité IA) depuis un programme au lieu d’une interface web. Celle de Crawlers.fr est une API REST asynchrone : vous créez un job, vous interrogez son statut, vous récupérez un résultat JSON.",
      },
    },
    {
      "@type": "Question",
      name: "Comment fonctionne l’API SEO de Crawlers.fr ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Vous envoyez un POST /v1/jobs avec le module souhaité et l’URL à analyser. L’API renvoie un job_id et un poll_url. Vous interrogez GET /v1/jobs/{id} toutes les 2 à 10 secondes jusqu’à obtenir le résultat structuré. Les jobs longs ne subissent aucun timeout.",
      },
    },
    {
      "@type": "Question",
      name: "Combien coûte l’API SEO ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "100 jobs cumulés sont gratuits chaque mois, sans carte bancaire. Au-delà, le modèle est pay-as-you-go : environ 0,05 € par job en moyenne, facturé au volume réel via Stripe, sans engagement.",
      },
    },
    {
      "@type": "Question",
      name: "Peut-on appeler l’API SEO depuis ChatGPT ou un agent IA ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui. Le format REST + JSON et l’authentification par clé Bearer sont directement exploitables par des agents (MCP, function calling, workflows n8n). Les 18 modules couvrent audit technique, score GEO, positions SERP et visibilité dans les LLM.",
      },
    },
  ],
};

export const Route = createFileRoute("/api-seo")({
  head: () =>
    pageHead({
      title: "API SEO REST : endpoints, JSON, quotas, tarifs",
      description:
        "API SEO REST async : 18 modules d’analyse (crawl, GEO, SERP, visibilité IA), auth par clé, 100 jobs gratuits/mois, pay-as-you-go ~0,05 €/job. Exemples JSON et endpoints.",
      path: "/api-seo",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "API SEO : intégrer les audits SEO et GEO dans vos applications",
          description:
            "Guide complet de l’API SEO de Crawlers.fr : endpoints, cycle de vie des jobs, exemples JSON, quotas et tarifs.",
          author: { "@type": "Person", name: "Adrien de Volontat", url: `${SITE_URL}/a-propos` },
          publisher: { "@type": "Organization", name: "Crawlers.fr", url: SITE_URL },
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/api-seo` },
        },
        faqSchema,
        buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "API SEO", path: "/api-seo" },
        ]),
      ],
    }),
  component: ApiSeoPage,
});
