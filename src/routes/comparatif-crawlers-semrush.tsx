import { createFileRoute } from "@tanstack/react-router";
import ComparatifCrawlersSemrush from "@/pages/ComparatifCrawlersSemrush";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-crawlers-semrush")({
  head: () => pageHead({
    title: "Alternative Semrush 2026 : Crawlers.fr — 28 critères",
    description: "Alternative à Semrush : comparatif Crawlers.fr vs Semrush sur 28 critères. Tarifs (gratuit vs 130€/mois), GEO, Cocoon 3D, marque blanche.",
    path: "/comparatif-crawlers-semrush",
    ogType: "article",
  }),
  component: ComparatifCrawlersSemrush,
});
