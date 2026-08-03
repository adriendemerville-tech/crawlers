import { createFileRoute } from "@tanstack/react-router";
import ContentArchitectPage from "@/pages/ContentArchitectPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/content-architect")({
  head: () => pageHead({
    title: "Content Architect — contenu SEO & GEO automatisé",
    description: "Générez des pages SEO optimisées en 30 secondes. Publication sur 7 CMS. Images IA multi-moteurs, schema.org, brouillons, 5 crédits/page ou illimité en Pro Agency.",
    path: "/content-architect",
    noIndex: true,
  }),
  component: ContentArchitectPage,
});
