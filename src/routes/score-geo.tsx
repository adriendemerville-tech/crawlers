import { createFileRoute } from "@tanstack/react-router";
import ScoreGEO from "@/pages/ScoreGEO";

export const Route = createFileRoute("/score-geo")({
  component: ScoreGEO,
});
