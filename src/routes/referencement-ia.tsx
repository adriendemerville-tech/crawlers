import { createFileRoute } from "@tanstack/react-router";
import ReferencementIA, { REFERENCEMENT_IA_FAQ } from "@/pages/ReferencementIA";
import { pageHead, SITE_URL } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/referencement-ia")({
  head: () =>
    pageHead({
      title: "Référencement IA (GEO) : être cité par ChatGPT et Perplexity",
      description:
        "Guide complet du référencement IA : accès des crawlers GPTBot/PerplexityBot, passages citables, autorité de marque, mesure du score GEO. Données réelles du web francophone.",
      path: "/referencement-ia",
      ogType: "article",
      keywords:
        "référencement ia, geo, generative engine optimization, visibilité ia, être cité chatgpt, référencement chatgpt",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline:
            "Référencement IA : être cité par ChatGPT, Perplexity et Gemini",
          description:
            "Méthode complète de référencement IA (GEO) : accès des crawlers IA, passages citables, autorité de marque et mesure continue.",
          mainEntityOfPage: `${SITE_URL}/referencement-ia`,
          author: {
            "@type": "Person",
            name: "Adrien de Volontat",
            url: `${SITE_URL}/auteur`,
          },
          publisher: {
            "@type": "Organization",
            name: "Crawlers.fr",
            url: SITE_URL,
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: REFERENCEMENT_IA_FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ],
    }),
  component: ReferencementIA,
});
