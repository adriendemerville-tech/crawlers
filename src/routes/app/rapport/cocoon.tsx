import { createFileRoute } from "@tanstack/react-router";
import RapportViewer from "@/pages/RapportViewer";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/rapport/cocoon")({
  head: () => pageHead({
    title: "Rapport de cocon sémantique — Crawlers.fr",
    description: "Rapport d'audit SEO & GEO détaillé généré par Crawlers.fr. Performance, technique, sémantique et visibilité IA.",
    path: "/app/rapport/cocoon",
    noIndex: true,
  }),
  component: RapportViewer,
});
