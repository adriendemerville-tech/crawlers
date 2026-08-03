import { createFileRoute } from "@tanstack/react-router";
import EEATPage from "@/pages/EEATPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/eeat")({
  head: () => pageHead({
    title: "E-E-A-T SEO & GEO 2026 — audit freelances & agences",
    description: "Audit E-E-A-T algorithmique, scoring SEO et GEO multi-sites, white-label et autopilote IA pour freelances et agences de référencement. Plan gratuit.",
    path: "/eeat",
    ogType: "article",
    image: "https://crawlers.fr/og-eeat.webp",
  }),
  component: EEATPage,
});
