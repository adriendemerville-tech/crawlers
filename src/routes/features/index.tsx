import { createFileRoute } from "@tanstack/react-router";
import Features from "@/pages/Features";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/features/")({
  head: () => pageHead({
    title: "Fonctionnalités — Crawlers.fr | SEO & GEO tout-en-un",
    description: "Toutes les fonctionnalités Crawlers.fr : audit SEO 168 critères, cocon sémantique, Content Architect, Score GEO, E-E-A-T, Autopilot.",
    path: "/features",
    
  }),
  component: Features,
});
