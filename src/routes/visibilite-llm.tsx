import { createFileRoute } from "@tanstack/react-router";
import VisibiliteLLM from "@/pages/VisibiliteLLM";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/visibilite-llm")({
  head: () => pageHead({
    title: "Visibilité LLM : votre marque est-elle citée par ChatGPT ?",
    description: "Mesurez si ChatGPT, Claude et Perplexity citent votre marque. Améliorez votre référencement ChatGPT et votre visibilité LLM en 2026.",
    path: "/visibilite-llm",
    ogType: "article",
    noIndex: true,
  }),
  component: VisibiliteLLM,
});
