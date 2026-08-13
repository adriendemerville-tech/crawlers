import { createFileRoute } from "@tanstack/react-router";
import Observatoire from "@/pages/Observatoire";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/observatoire")({
  head: () => pageHead({
    title: "Observatoire des citations IA & statistiques SEO du web FR",
    description: "Domaines et types de contenus les plus cités par les moteurs IA (ChatGPT, Perplexity, Gemini), plus les statistiques SEO du web francophone : JSON-LD, Core Web Vitals, HTTPS. Données anonymisées Crawlers.fr.",
    path: "/observatoire",
    keywords: "domaines les plus cités par les moteurs ia, types de contenus cités par les moteurs ia, observatoire geo, statistiques seo france",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Observatoire des citations des moteurs IA — Crawlers.fr",
        description:
          "Agrégation anonymisée des domaines et types de contenus cités par les moteurs génératifs (ChatGPT, Perplexity, Gemini) sur des requêtes du web francophone, fenêtre glissante de 90 jours.",
        url: "https://crawlers.fr/observatoire",
        license: "https://crawlers.fr/mentions-legales",
        creator: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
        isAccessibleForFree: true,
      },
    ],
  }),
  component: Observatoire,
});
