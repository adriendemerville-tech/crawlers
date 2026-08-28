import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";
import { homeJsonLd } from "@/lib/seo/homeSchemas";

export const Route = createFileRoute("/")({
  head: () => pageHead({
    title: "Audit SEO & GEO : positions SERP, backlinks, citations IA",
    description: "Mesurez votre référencement Google et votre visibilité dans ChatGPT sur des données réelles : crawl complet, positions SERP, backlinks, citations IA. Audit gratuit.",
    path: "/",
    jsonLd: homeJsonLd,
  }),
  component: Index,
});
