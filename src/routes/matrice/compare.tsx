import { createFileRoute } from "@tanstack/react-router";
import MatriceCompare from "@/pages/MatriceCompare";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/matrice/compare")({
  head: () => pageHead({
    title: "Comparaison d'audits matriciels — Crawlers.fr",
    description: "Comparez deux audits matriciels et visualisez les progressions et régressions par famille de critères.",
    path: "/matrice/compare",
    noIndex: true,
  }),
  component: MatriceCompare,
});
