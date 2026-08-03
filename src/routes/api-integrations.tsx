import { createFileRoute } from "@tanstack/react-router";
import ApiIntegrations from "@/pages/ApiIntegrations";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/api-integrations")({
  head: () => pageHead({
    title: "API & Intégrations — Connectez vos outils SEO | Crawlers.fr",
    description: "Découvrez toutes les API et intégrations disponibles dans Crawlers.fr : Google Search Console, GA4, Matomo, CMS, Marina API. Données anonymisées, déconnexion en 1 clic.",
    path: "/api-integrations",
    noIndex: true,
  }),
  component: ApiIntegrations,
});
