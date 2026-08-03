import { createFileRoute } from "@tanstack/react-router";
import ParmenionApiDoc from "@/pages/docs/ParmenionApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/parmenion")({
  head: () => pageHead({
    title: "API Parménion — Documentation REST (mode pull) | Crawlers.fr",
    description: "Documentation complète de l'API Parménion : votre site poll les tâches de contenu SEO planifiées, les publie sur votre CMS, et notifie le résultat. Endpoint REST, auth Bearer, codes d'erreur, exemples PHP/Node/Python.",
    path: "/docs/api/parmenion",
    ogType: "article",
  }),
  component: ParmenionApiDoc,
});
