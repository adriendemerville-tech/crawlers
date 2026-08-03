import { createFileRoute } from "@tanstack/react-router";
import AppEeat from "@/pages/AppEeat";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/eeat")({
  head: () => pageHead({
    title: "Audit E-E-A-T — Score de confiance Google",
    description: "Analysez gratuitement votre score E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). Diagnostic algorithme multi-pages avec plan d'action.",
    path: "/app/eeat",
    noIndex: true,
  }),
  component: AppEeat,
});
