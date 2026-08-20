import { createFileRoute } from "@tanstack/react-router";
import SiteCrawl from "@/pages/SiteCrawl";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/site-crawl")({
  head: () => pageHead({
    title: "Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr",
    description: "Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus.",
    path: "/app/site-crawl",
    // Le pilier public /crawl porte l'intention « outil de crawl ».
    canonicalPath: "/crawl",
    noIndex: true,
  }),
  component: SiteCrawl,
});
