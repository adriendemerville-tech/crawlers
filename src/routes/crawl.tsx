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
      title: "Outil de crawl de site web — jusqu'à 10 000 pages | Crawlers.fr",
      description:
        "Crawlez jusqu'à 10 000 URL sans rien installer : liens cassés, erreurs d'indexation, profondeur, pages orphelines et cannibalisation, avec un plan par URL.",
      path: "/crawl",
      ogType: "article",
      jsonLd: OUTIL_CRAWL_JSONLD,
    }),
  component: OutilCrawl,
});
