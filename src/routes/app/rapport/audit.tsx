import { createFileRoute } from "@tanstack/react-router";
import RapportViewer from "@/pages/RapportViewer";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/rapport/audit")({
  head: () => pageHead({
    title: "Rapport d'audit SEO & GEO — Crawlers.fr",
    description: "Rapport d'audit SEO & GEO détaillé généré par Crawlers.fr. Performance, technique, sémantique et visibilité IA.",
    path: "/app/rapport/audit",
    noIndex: true,
  }),
  component: RapportViewer,
});
