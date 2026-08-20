import { createFileRoute } from "@tanstack/react-router";
import ParmenionApiDoc from "@/pages/docs/ParmenionApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/parmenion")({
  head: () => pageHead({
    title: "API Parménion — documentation REST (mode pull)",
    description: "API Parménion : votre site récupère les tâches de contenu SEO planifiées, les publie sur son CMS et notifie le résultat. REST, auth Bearer, exemples.",
    path: "/docs/api/parmenion",
    ogType: "article",
  }),
  component: ParmenionApiDoc,
});
