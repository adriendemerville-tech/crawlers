import { createFileRoute } from "@tanstack/react-router";
import AnalyseLogs from "@/pages/AnalyseLogs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-logs")({
  head: () => pageHead({
    title: "Analyse de logs serveur — crawl Google & IA | Crawlers",
    description: "Analysez vos logs serveur pour comprendre comment Googlebot et les bots IA explorent votre site. Détectez le budget crawl gaspillé, les pages orphelines et optimisez votre indexation.",
    path: "/analyse-logs",
    ogType: "article",
    noIndex: true,
  }),
  component: AnalyseLogs,
});
