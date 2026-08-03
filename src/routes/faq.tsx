import { createFileRoute } from "@tanstack/react-router";
import Faq from "@/pages/Faq";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/faq")({
  head: () => pageHead({
    title: "FAQ Crawlers.fr — Questions fréquentes SEO & GEO | Crawlers.fr",
    description: "FAQ Crawlers.fr — toutes les réponses sur l'audit SEO, le GEO Score, la visibilité LLM, les crédits, le plan Pro Agency et l'intégration technique.",
    path: "/faq",
  }),
  component: Faq,
});
