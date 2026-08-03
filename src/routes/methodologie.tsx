import { createFileRoute } from "@tanstack/react-router";
import Methodologie from "@/pages/Methodologie";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/methodologie")({
  head: () => pageHead({
    title: "Méthodologie d'audit SEO & GEO — 7 algorithmes | Crawlers.fr",
    description: "Méthodologie Crawlers.fr — 7 algorithmes propriétaires, 150+ points d'audit, architecture multi-fallback, RGPD natif. Comment nous calculons vos scores SEO et GEO.",
    path: "/methodologie",
    ogType: "article",
  }),
  component: Methodologie,
});
