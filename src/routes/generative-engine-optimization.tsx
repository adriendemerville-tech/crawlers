import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

// Pilier unique GEO : absorbe /score-geo, /outil-geo-ia, /visibilite-llm,
// /optimisation-llm-seo et /referencement-ia (301 permanents).
const TITLE = "Référencement IA et GEO : guide 2026 et audit gratuit";
const DESCRIPTION =
  "Référencement IA (GEO) : définition, différences SEO/GEO, score GEO et visibilité LLM. Mesurez votre citabilité dans ChatGPT, Perplexity et Gemini, audit gratuit.";

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
