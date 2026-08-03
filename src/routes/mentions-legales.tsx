import { createFileRoute } from "@tanstack/react-router";
import MentionsLegales from "@/pages/MentionsLegales";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/mentions-legales")({
  head: () => pageHead({
    title: "Mentions légales | Crawlers.fr",
    description: "Mentions légales de Crawlers.fr — éditeur, hébergement, conditions.",
    path: "/mentions-legales",
    noIndex: true,
  }),
  component: MentionsLegales,
});
