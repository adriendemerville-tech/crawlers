import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";
import { homeJsonLd } from "@/lib/seo/homeSchemas";

const homeHead = pageHead({
  title: "Crawlers.fr — outil de crawl SEO & GEO : audit, positions, IA",
  description: "Crawlers.fr, l'outil de crawl SEO & GEO : audit technique complet, positions SERP, backlinks et citations IA. Démarrez votre audit gratuit, sans engagement.",
  path: "/",
  jsonLd: homeJsonLd,
});

export const Route = createFileRoute("/")({
  // React 19 transforme automatiquement l'image SSR avec fetchPriority="high"
  // en preload unique : pas besoin de dupliquer la même ressource dans head().
  head: () => homeHead,
  component: Index,
});
