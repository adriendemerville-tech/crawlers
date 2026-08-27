import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

// Pilier unique GEO : absorbe /score-geo, /outil-geo-ia, /visibilite-llm,
// /optimisation-llm-seo et /referencement-ia (301 permanents).
const TITLE = "GEO : mesurer sa citabilité par ChatGPT, Claude, Perplexity";
const DESCRIPTION =
  "Le GEO (référencement IA) consiste à être cité dans les réponses de ChatGPT, Perplexity et Gemini, pas seulement classé sur Google. Définition, mesure et audit.";

export const Route = createFileRoute("/generative-engine-optimization")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/generative-engine-optimization",
      jsonLd: [
        marinaMentionJsonLd({
          path: "/generative-engine-optimization",
          name: TITLE,
          description: DESCRIPTION,
        }),
      ],
      ogType: "article",
    }),
  component: GenerativeEngineOptimization,
});
