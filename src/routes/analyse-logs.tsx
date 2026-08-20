import { createFileRoute } from "@tanstack/react-router";
import AnalyseLogs from "@/pages/AnalyseLogs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-logs")({
  head: () => pageHead({
    title: "Analyse de logs serveur : crawl Google et bots IA",
    description: "Analysez vos logs serveur pour voir comment Googlebot et les bots IA explorent votre site : budget de crawl gaspillé, pages orphelines, fréquence de passage.",
    path: "/analyse-logs",
    ogType: "article",
  }),
  component: AnalyseLogs,
});
