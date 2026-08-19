import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/generative-engine-optimization")({
  head: () => pageHead({
    title: "Generative Engine Optimization (GEO) : guide 2026 + audit gratuit",
    description: "Définition du GEO, différences SEO/GEO et stratégies pour ChatGPT, Perplexity et Gemini. Audit GEO gratuit : 220+ points mesurés, 9 questions aux IA.",
    path: "/generative-engine-optimization",
    jsonLd: [marinaMentionJsonLd({ path: "/generative-engine-optimization", name: "Generative Engine Optimization (GEO) : guide 2026 + audit gratuit", description: "Définition du GEO, différences SEO/GEO et stratégies pour ChatGPT, Perplexity et Gemini. Audit GEO gratuit : 220+ points mesurés, 9 questions aux IA." })],
    ogType: "article",
  }),
  component: GenerativeEngineOptimization,
});
