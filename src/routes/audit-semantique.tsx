import { createFileRoute } from "@tanstack/react-router";
import AuditSemantique from "@/pages/AuditSemantique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/audit-semantique")({
  head: () => pageHead({
    title: "Audit sémantique gratuit — profondeur de contenu | Crawlers.fr",
    description: "Audit sémantique gratuit : profondeur de contenu, couverture de mots-clés, angles manquants et signaux E-E-A-T mesurés page par page.",
    path: "/audit-semantique",
  }),
  component: AuditSemantique,
});
