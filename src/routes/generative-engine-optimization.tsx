import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/generative-engine-optimization")({
  head: () => pageHead({
    title: "Generative Engine Optimization (GEO) : guide complet 2026",
    description: "Qu'est-ce que le GEO ? Définition, différences SEO/GEO, stratégies d'optimisation pour ChatGPT, Perplexity, Gemini et Google AI Overviews.",
    path: "/generative-engine-optimization",
    ogType: "article",
  }),
  component: GenerativeEngineOptimization,
});
