import { createFileRoute } from "@tanstack/react-router";
import EEATPage from "@/pages/EEATPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/eeat")({
  head: () => pageHead({
    title: "E-E-A-T SEO & GEO 2026 — audit freelances & agences",
    description: "Comment prouver votre E-E-A-T à Google et aux IA : scoring algorithmique des signaux d'expérience, d'expertise et d'autorité, page par page, avec les correctifs.",
    path: "/eeat",
    ogType: "article",
    image: "https://crawlers.fr/og-eeat.webp",
  }),
  component: EEATPage,
});
