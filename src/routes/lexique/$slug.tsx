import { createFileRoute } from "@tanstack/react-router";
import ExpertTermPage from "@/pages/Lexique/ExpertTermPage";
import { getExpertTermBySlug } from "@/data/expertTerms";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/lexique/$slug")({
  head: ({ params }) => {
    const term = getExpertTermBySlug(params.slug, "fr");
    if (!term) {
      return pageHead({
        title: "Terme introuvable | Crawlers.fr",
        description: "Ce terme du lexique SEO, GEO et IA de Crawlers.fr n'existe pas.",
        path: `/lexique/${params.slug}`,
        noIndex: true,
      });
    }
    return pageHead({
      title: `${term.term} — Définition Expert | Crawlers.fr`,
      description: term.fullDefinition.slice(0, 155),
      path: `/lexique/${params.slug}`,
      ogType: "article",
    });
  },
  component: ExpertTermPage,
});
