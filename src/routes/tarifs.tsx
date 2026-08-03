import { createFileRoute } from "@tanstack/react-router";
import Tarifs from "@/pages/Tarifs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/tarifs")({
  head: () => pageHead({
    title: "Tarifs Crawlers.fr — SEO + GEO à 29€/mois | Crawlers.fr",
    description: "Crawlers.fr à 29€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil.",
    path: "/tarifs",
  }),
  component: Tarifs,
});
