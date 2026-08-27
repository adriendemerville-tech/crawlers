import { createFileRoute } from "@tanstack/react-router";
import MentionsLegales from "@/pages/MentionsLegales";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/mentions-legales")({
  head: () => pageHead({
    title: "Mentions légales | Crawlers.fr",
    description: "Éditeur : Voluntas Novare (SASU, SIREN 992 399 667), Saint-Rémy-de-Provence. Hébergement dans l'Union européenne, contact et conditions d'utilisation.",
    path: "/mentions-legales",
    noIndex: true,
  }),
  component: MentionsLegales,
});
