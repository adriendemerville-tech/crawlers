import { createFileRoute } from "@tanstack/react-router";
import AuthorPage from "@/pages/AuthorPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/auteur/adrien-de-volontat")({
  head: () => pageHead({
    title: "Adrien de Volontat — Fondateur Crawlers.fr | SEO & GEO",
    description: "Adrien de Volontat, fondateur de Crawlers.fr. Journaliste devenu expert SEO et GEO (Generative Engine Optimization), spécialiste de la visibilité dans ChatGPT, Perplexity et Claude.",
    path: "/auteur/adrien-de-volontat",
    ogType: "profile",
  }),
  component: AuthorPage,
});
