import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";

export const Route = createFileRoute("/monitoring-gptbot-perplexity")({
  component: KeywordPillarPage,
});
