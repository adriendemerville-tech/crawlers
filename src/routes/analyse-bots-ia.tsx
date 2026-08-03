import { createFileRoute } from "@tanstack/react-router";
import AnalyseBotsIA from "@/pages/AnalyseBotsIA";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-bots-ia")({
  head: () => pageHead({
    title: "Analyse Bots IA : GPTBot, ClaudeBot, PerplexityBot sur site",
    description: "Vérifiez gratuitement si robots.txt bloque GPTBot, ClaudeBot, PerplexityBot. Optimisez l'accès des crawlers IA pour votre référencement GEO.",
    path: "/analyse-bots-ia",
    ogType: "article",
  }),
  component: AnalyseBotsIA,
});
