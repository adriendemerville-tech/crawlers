import { createFileRoute } from "@tanstack/react-router";
import Aide from "@/pages/Aide";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/aide")({
  head: () => pageHead({
    title: "Centre d'aide Crawlers.fr — Documentation SEO, GEO & visibilité IA",
    description: "Trouvez toutes les réponses sur les audits SEO, le GEO Score, la visibilité LLM, les crédits et le plan Pro Agency. Documentation complète Crawlers.fr.",
    path: "/aide",
  }),
  component: Aide,
});
