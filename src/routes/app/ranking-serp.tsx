import { createFileRoute } from "@tanstack/react-router";
import RankingSerp from "@/pages/RankingSerp";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/ranking-serp")({
  head: () => pageHead({
    title: "Benchmark Rank SERP — Classement Google multi-providers gratuit | Crawlers.fr",
    description: "Comparez les positions Google de n'importe quel mot-clé via 4 providers SERP simultanément (DataForSEO, SerpApi, Serper, Bright Data). Outil gratuit, classement croisé fiable.",
    path: "/app/ranking-serp",

  }),
  component: RankingSerp,
});
