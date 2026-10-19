import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersScreamingFrog from "@/pages/ComparatifCrawlersScreamingFrog";
import { SCREAMING_FROG_JSONLD } from "@/pages/ComparatifCrawlersScreamingFrog.seo";
import { pageHead } from "@/lib/seo/pageHead";

// Satellite du silo « Comparatifs » (pilier : /comparatif-crawlers-semrush).
export const Route = createFileRoute("/comparatif-crawlers-screaming-frog")({
  head: () =>
    pageHead({
      title: "Alternative Screaming Frog 2026 : crawl en ligne sans limite",
      description:
        "Ahrefs vs Screaming Frog et Semrush vs Screaming Frog, à côté de Crawlers.fr : crawl en ligne ou logiciel de bureau, visibilité IA, sans prix ajouté.",
      path: "/comparatif-crawlers-screaming-frog",
      ogType: "article",
      jsonLd: SCREAMING_FROG_JSONLD,
    }),
  component: ComparatifCrawlersScreamingFrog,
});
