import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

// Pilier unique GEO : absorbe /score-geo, /outil-geo-ia, /visibilite-llm,
// /optimisation-llm-seo et /referencement-ia (301 permanents).
const TITLE = "Référencement IA & GEO : guide 2026, score et audit gratuit";
const DESCRIPTION =
  "Référencement IA (GEO) : définition, différences SEO/GEO, score GEO et visibilité LLM. Optimisez votre citabilité dans ChatGPT, Perplexity et Gemini. Audit gratuit : 220+ points mesurés, 9 questions posées aux IA.";

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
