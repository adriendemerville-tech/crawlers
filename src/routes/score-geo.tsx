import { createFileRoute } from "@tanstack/react-router";
import ScoreGEO from "@/pages/ScoreGEO";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/score-geo")({
  head: () => pageHead({
    title: "Score GEO : référencement ChatGPT & Claude + audit gratuit",
    description: "Mesurez votre visibilité dans ChatGPT, Claude et Perplexity. Audit GEO gratuit : 18 sections, 220+ points mesurés, 9 questions réellement posées aux IA.",
    path: "/score-geo",
    jsonLd: [marinaMentionJsonLd({ path: "/score-geo", name: "Score GEO : référencement ChatGPT & Claude + audit gratuit", description: "Mesurez votre visibilité dans ChatGPT, Claude et Perplexity. Audit GEO gratuit : 18 sections, 220+ points mesurés, 9 questions réellement posées aux IA." })],
    ogType: "article",
  }),
  component: ScoreGEO,
});
