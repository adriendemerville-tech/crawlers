import { createFileRoute } from "@tanstack/react-router";
import AuthorPage from "@/pages/AuthorPage";
import { pageHead } from "@/lib/seo/pageHead";
import { buildBreadcrumbJsonLd, buildProfilePageJsonLd } from "@/lib/seo/articleSchema";

export const Route = createFileRoute("/auteur/adrien-de-volontat")({
  head: () => pageHead({
    title: "Adrien de Volontat — Fondateur Crawlers.fr | SEO & GEO",
    description: "Adrien de Volontat, fondateur de Crawlers.fr : journaliste devenu expert SEO et GEO, spécialiste de la visibilité dans ChatGPT, Perplexity et Claude.",
    path: "/auteur/adrien-de-volontat",
    ogType: "profile",
    jsonLd: [
      buildProfilePageJsonLd({
        name: "Adrien de Volontat",
        path: "/auteur/adrien-de-volontat",
        jobTitle: "Fondateur de Crawlers.fr, consultant SEO et GEO",
        description:
          "Journaliste devenu expert du référencement, Adrien de Volontat conçoit les moteurs d'audit SEO et GEO de Crawlers.fr et accompagne agences et indépendants sur la visibilité dans les moteurs génératifs.",
        knowsAbout: [
          "Generative Engine Optimization",
          "Référencement naturel",
          "Audit technique de site web",
          "Données structurées Schema.org",
          "Crawl et analyse de logs",
        ],
      }),
      buildBreadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Auteurs", path: "/auteur" },
        { name: "Adrien de Volontat", path: "/auteur/adrien-de-volontat" },
      ]),
    ],
  }),
  component: AuthorPage,
});
