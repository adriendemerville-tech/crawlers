import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersScreamingFrog, {
  SCREAMING_FROG_JSONLD,
} from "@/pages/ComparatifCrawlersScreamingFrog";
import { pageHead } from "@/lib/seo/pageHead";

// Satellite du silo « Comparatifs » (pilier : /comparatif-crawlers-semrush).
export const Route = createFileRoute("/comparatif-crawlers-screaming-frog")({
  head: () =>
    pageHead({
      title: "Alternative Screaming Frog 2026 : crawl en ligne sans limite",
      description:
        "Crawlers.fr vs Screaming Frog sur 10 critères : crawl en ligne jusqu'à 10 000 URL, rendu JavaScript, cocon sémantique, visibilité ChatGPT.",
      path: "/comparatif-crawlers-screaming-frog",
      ogType: "article",
      jsonLd: SCREAMING_FROG_JSONLD,
    }),
  component: ComparatifCrawlersScreamingFrog,
});
