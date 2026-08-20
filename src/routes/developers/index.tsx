import { createFileRoute } from "@tanstack/react-router";
import DevLanding from "@/pages/developers/DevLanding";
import { pageHead } from "@/lib/seo/pageHead";
import { buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";

export const Route = createFileRoute("/developers/")({
  head: () => pageHead({
    title: "API SEO & GEO pour développeurs — REST async, pay-as-you-go",
    description: "3 APIs REST async (Crawlers, Marina, Parménion) pour automatiser SEO, GEO et visibilité IA. 100 jobs gratuits/mois, auth par clé, sans engagement.",
    path: "/developers",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebAPI",
        name: "API Crawlers.fr",
        description:
          "Trois APIs REST asynchrones (Crawlers, Marina, Parménion) pour automatiser le crawl technique, l'audit SEO/GEO et la prescription d'optimisations.",
        url: "https://crawlers.fr/developers",
        documentation: "https://crawlers.fr/developers/docs",
        provider: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
      },
      buildBreadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Développeurs", path: "/developers" },
      ]),
    ],
  }),
  component: DevLanding,
});
