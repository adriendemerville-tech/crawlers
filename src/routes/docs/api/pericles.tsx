import { createFileRoute } from "@tanstack/react-router";
import PericlesApiDoc from "@/pages/docs/PericlesApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/pericles")({
  head: () => pageHead({
    title: "API Périclès — documentation REST (mode pull)",
    description: "API Périclès : votre site récupère les tâches de contenu SEO planifiées, les publie sur son CMS et notifie le résultat. REST, auth Bearer, exemples.",
    path: "/docs/api/pericles",
    ogType: "article",
  }),
  component: PericlesApiDoc,
});
