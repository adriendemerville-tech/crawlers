import { createFileRoute } from "@tanstack/react-router";
import ScoreGEO from "@/pages/ScoreGEO";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/score-geo")({
  head: () => pageHead({
    title: "Score GEO : mesurez votre référencement ChatGPT & Claude",
    description: "Score GEO gratuit : évaluez la capacité de votre site à être cité par ChatGPT, Claude et Perplexity. Référencement GEO et LLM SEO en 2026.",
    path: "/score-geo",
    ogType: "article",
  }),
  component: ScoreGEO,
});
