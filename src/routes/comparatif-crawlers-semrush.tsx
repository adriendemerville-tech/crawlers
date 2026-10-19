import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersSemrush from "@/pages/ComparatifCrawlersSemrush";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-crawlers-semrush")({
  head: () => pageHead({
    title: "Crawlers, l'alternative française à Semrush — 28 critères",
    description: "Semrush crawler : le robot du Site Audit (SemrushBot), comparé au crawl hébergé de Crawlers.fr, au score GEO et à la visibilité LLM.",
    path: "/comparatif-crawlers-semrush",
    ogType: "article",
  }),
  component: ComparatifCrawlersSemrush,
});
