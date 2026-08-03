import { createFileRoute } from "@tanstack/react-router";
import RankingSerp from "@/pages/RankingSerp";

export const Route = createFileRoute("/app/ranking-serp")({
  component: RankingSerp,
});
