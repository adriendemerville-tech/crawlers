import { createFileRoute } from "@tanstack/react-router";
import OutilCrawl from "@/pages/OutilCrawl";
import { OUTIL_CRAWL_JSONLD } from "@/pages/OutilCrawl.seo";
import { pageHead } from "@/lib/seo/pageHead";

// Pilier « Outil de crawl » : page produit canonique pour crawl website /
// crawl wordpress / site crawler. /app/site-crawl (l'application) est noindex
// et canonicalisée vers cette page.
export const Route = createFileRoute("/crawl")({
  head: () =>
    pageHead({
      title: "Crawl WordPress sans plugin | Crawlers.fr",
      description:
        "Crawlez un site WordPress sans extension : le crawl lit le HTML servi (archives, pagination, doublons de taxonomies, liens, indexation) et rend un plan par URL.",
      path: "/crawl",
      ogType: "article",
      jsonLd: OUTIL_CRAWL_JSONLD,
    }),
  component: OutilCrawl,
});
