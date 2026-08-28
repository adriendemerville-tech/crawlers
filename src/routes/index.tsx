import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";
import { homeJsonLd } from "@/lib/seo/homeSchemas";

export const Route = createFileRoute("/")({
  head: () => pageHead({
    title: "Crawlers.fr — outil de crawl SEO & GEO : audit, positions, IA",
    description: "Crawlers.fr, l'outil de crawl SEO & GEO : audit technique complet, positions SERP, backlinks et citations IA. Démarrez votre audit gratuit, sans engagement.",
    path: "/",
    jsonLd: homeJsonLd,
  }),
  component: Index,
});
