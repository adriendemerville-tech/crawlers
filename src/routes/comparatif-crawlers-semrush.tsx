import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersSemrush from "@/pages/ComparatifCrawlersSemrush";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-crawlers-semrush")({
  head: () => pageHead({
    title: "Crawlers, l'alternative française à Semrush — 28 critères",
    description: "L'alternative française à Semrush : oui sur le crawl technique, l'architecture et la visibilité IA ; non sur l'index de backlinks. 28 critères, gratuit vs 130 €/mois.",
    path: "/comparatif-crawlers-semrush",
    ogType: "article",
  }),
  component: ComparatifCrawlersSemrush,
});
