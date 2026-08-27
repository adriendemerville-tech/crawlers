import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersSemrush from "@/pages/ComparatifCrawlersSemrush";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-crawlers-semrush")({
  head: () => pageHead({
    title: "Alternative Semrush 2026 : Crawlers.fr — 28 critères",
    description: "Oui sur le crawl technique, l'architecture et la visibilité IA ; non sur l'index de backlinks. Comparatif sur 28 critères, gratuit vs 130 €/mois.",
    path: "/comparatif-crawlers-semrush",
    ogType: "article",
  }),
  component: ComparatifCrawlersSemrush,
});
