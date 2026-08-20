import { createFileRoute } from "@tanstack/react-router";
import CrawlersApiDoc from "@/pages/docs/CrawlersApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/crawlers")({
  head: () => pageHead({
    title: "API Crawlers — documentation REST unifiée, 18 modules",
    description: "API Crawlers : une clé crw_live_ pour 18 modules (audit, crawl, cocoon, GEO, LLM, SERP). REST asynchrone par polling, exemples Node, PHP, Python.",
    path: "/docs/api/crawlers",
    ogType: "article",
  }),
  component: CrawlersApiDoc,
});
