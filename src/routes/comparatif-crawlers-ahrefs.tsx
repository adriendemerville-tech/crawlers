import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersAhrefs from "@/pages/ComparatifCrawlersAhrefs";
import { AHREFS_JSONLD } from "@/pages/ComparatifCrawlersAhrefs.seo";
import { pageHead } from "@/lib/seo/pageHead";

// Satellite du silo « Comparatifs » (pilier : /comparatif-crawlers-semrush).
export const Route = createFileRoute("/comparatif-crawlers-ahrefs")({
  head: () =>
    pageHead({
      title: "Crawlers, l'alternative française à Ahrefs — 8 critères",
      description:
        "L'alternative française à Ahrefs : backlinks, crawl technique 10 000 URL, cocon sémantique, visibilité ChatGPT et Perplexity, tarifs — comparatif sur 8 critères.",
      path: "/comparatif-crawlers-ahrefs",
      ogType: "article",
      jsonLd: AHREFS_JSONLD,
    }),
  component: ComparatifCrawlersAhrefs,
});
