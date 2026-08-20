import { createFileRoute } from "@tanstack/react-router";
import DevDocs from "@/pages/developers/DevDocs";
import { pageHead } from "@/lib/seo/pageHead";
import { buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";

export const Route = createFileRoute("/developers/docs")({
  head: () => pageHead({
    title: "Documentation API — Crawlers Developers",
    description: "Documentation de l'API REST Crawlers : authentification, endpoints /v1/jobs et features disponibles.",
    path: "/developers/docs",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "Documentation de l'API REST Crawlers",
        description:
          "Authentification par clé, endpoints /v1/jobs, cycle de vie asynchrone des jobs et features disponibles de l'API Crawlers.",
        url: "https://crawlers.fr/developers/docs",
        publisher: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
        mainEntityOfPage: { "@type": "WebPage", "@id": "https://crawlers.fr/developers/docs" },
      },
      buildBreadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Développeurs", path: "/developers" },
        { name: "Documentation", path: "/developers/docs" },
      ]),
    ],
  }),
  component: DevDocs,
});
