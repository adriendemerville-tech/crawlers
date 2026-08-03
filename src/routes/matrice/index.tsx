import { createFileRoute } from "@tanstack/react-router";
import MatricePrompt from "@/pages/MatricePrompt";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/matrice/")({
  head: () => pageHead({
    title: "Matrice d'audit SEO & GEO | Crawlers.fr",
    description: "Composez votre grille d'audit sur-mesure : balises, données structurées, performance, sécurité, prompts LLM, métriques combinées. Score pondéré global.",
    path: "/matrice",
    noIndex: true,
  }),
  component: MatricePrompt,
});
