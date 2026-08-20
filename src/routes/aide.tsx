import { createFileRoute } from "@tanstack/react-router";
import Aide from "@/pages/Aide";
import { pageHead } from "@/lib/seo/pageHead";
import { aideJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/aide")({
  head: () => pageHead({
    title: "Centre d'aide Crawlers.fr — SEO, GEO et visibilité IA",
    description: "Trouvez toutes les réponses sur les audits SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency. Documentation complète Crawlers.fr.",
    path: "/aide",
    jsonLd: [aideJsonLd],
  }),
  component: Aide,
});
