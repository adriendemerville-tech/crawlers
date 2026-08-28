import { createFileRoute } from "@tanstack/react-router";
import Lexique from "@/pages/Lexique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/lexique/")({
  head: () => pageHead({
    title: "Glossaire SEO : lexique GEO, IA et performance web | Crawlers.fr",
    description: "Glossaire SEO et lexique GEO : définitions claires de GEO, AEO, E-E-A-T, LLM, IAS, cocon sémantique, Part de Voix, LCP et CLS, classées par ordre alphabétique.",
    path: "/lexique",
    keywords: "glossaire SEO, lexique SEO, glossaire GEO, définitions SEO, LCP, CLS, LLM, SGE, E-E-A-T, Core Web Vitals",
  }),
  component: Lexique,
});
