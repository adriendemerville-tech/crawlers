import { createFileRoute } from "@tanstack/react-router";
import AnalyseBotsIA from "@/pages/AnalyseBotsIA";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-bots-ia")({
  head: () => pageHead({
    title: "Analyse Bots IA : GPTBot, ClaudeBot, PerplexityBot sur site",
    description: "Votre robots.txt bloque-t-il GPTBot, ClaudeBot ou PerplexityBot ? Vérification gratuite en 10 secondes, avec les lignes exactes à corriger pour ouvrir l'accès.",
    path: "/analyse-bots-ia",
    ogType: "article",
  }),
  component: AnalyseBotsIA,
});
