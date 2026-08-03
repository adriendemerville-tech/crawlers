import { createFileRoute } from "@tanstack/react-router";
import MarinaApiDoc from "@/pages/docs/MarinaApiDoc";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/docs/api/marina")({
  head: () => pageHead({
    title: "API Marina — Documentation REST | Crawlers.fr",
    description: "Documentation complète de l'API Marina : générez des rapports SEO/GEO en marque blanche depuis votre site. Endpoint REST, authentification par clé, webhook callback, multilingue.",
    path: "/docs/api/marina",
    ogType: "article",
  }),
  component: MarinaApiDoc,
});
