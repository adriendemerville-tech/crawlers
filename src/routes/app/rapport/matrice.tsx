import { createFileRoute } from "@tanstack/react-router";
import RapportMatrice from "@/pages/RapportMatrice";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/rapport/matrice")({
  head: () => pageHead({
    title: "Rapport Matrice d'audit — Crawlers.fr",
    description: "Résultats détaillés de votre matrice d'audit : balises, données structurées, performance, sécurité, prompts LLM et score pondéré global.",
    path: "/app/rapport/matrice",
    noIndex: true,
  }),
  component: RapportMatrice,
});
