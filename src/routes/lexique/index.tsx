import { createFileRoute } from "@tanstack/react-router";
import Lexique from "@/pages/Lexique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/lexique/")({
  head: () => pageHead({
    title: "Lexique SEO, GEO et IA 2026 | Crawlers.fr",
    description: "Lexique SEO, GEO et IA 2026 — définitions complètes : GEO, AEO, E-E-A-T, LLM, IAS, cocon sémantique, Part de Voix, Triangle Prédictif.",
    path: "/lexique",
    keywords: "lexique SEO, glossaire GEO, définitions performance web, LCP, CLS, LLM, SGE, E-E-A-T, Core Web Vitals, 2026",
  }),
  component: Lexique,
});
