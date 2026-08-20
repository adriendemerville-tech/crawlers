import { createFileRoute } from "@tanstack/react-router";
import Methodologie from "@/pages/Methodologie";
import { pageHead } from "@/lib/seo/pageHead";
import { methodologieJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/methodologie")({
  head: () => pageHead({
    title: "Méthodologie d'audit SEO & GEO — 7 algorithmes | Crawlers.fr",
    description: "7 algorithmes propriétaires, 150+ points d'audit, architecture multi-fallback, RGPD natif : comment Crawlers.fr calcule vos scores SEO et GEO.",
    path: "/methodologie",
    ogType: "article",
    jsonLd: methodologieJsonLd,
  }),
  component: Methodologie,
});
