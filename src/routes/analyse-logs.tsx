import { createFileRoute } from "@tanstack/react-router";
import AnalyseLogs from "@/pages/AnalyseLogs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-logs")({
  head: () => pageHead({
    title: "Analyse de logs serveur : crawl Google et bots IA",
    description: "Voyez quelles pages Googlebot et GPTBot visitent, à quelle fréquence, et où votre budget de crawl se perd. Analyse de logs serveur et pages orphelines détectées.",
    path: "/analyse-logs",
    ogType: "article",
  }),
  component: AnalyseLogs,
});
