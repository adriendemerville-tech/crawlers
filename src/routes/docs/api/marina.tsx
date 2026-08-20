import { createFileRoute } from "@tanstack/react-router";
import MarinaApiDoc from "@/pages/docs/MarinaApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/marina")({
  head: () => pageHead({
    title: "API Marina — Documentation REST | Crawlers.fr",
    description: "API Marina : générez des rapports SEO/GEO en marque blanche depuis votre site. Endpoint REST, clé d'API, webhook de callback.",
    path: "/docs/api/marina",
    ogType: "article",
  }),
  component: MarinaApiDoc,
});
