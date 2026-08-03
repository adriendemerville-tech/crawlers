import { createFileRoute } from "@tanstack/react-router";
import CrawlersApiDoc from "@/pages/docs/CrawlersApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/crawlers")({
  head: () => pageHead({
    title: "API Crawlers — Documentation REST unifiée (18 modules) | Crawlers.fr",
    description: "Documentation complète de l'API Crawlers : une seule clé crw_live_ pour 18 modules (audit, crawl, cocoon, GEO, LLM, SERP, observatoire). REST asynchrone par polling. Exemples Node, PHP, Python.",
    path: "/docs/api/crawlers",
    ogType: "article",
  }),
  component: CrawlersApiDoc,
});
