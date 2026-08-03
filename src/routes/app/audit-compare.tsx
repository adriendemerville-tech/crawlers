import { createFileRoute } from "@tanstack/react-router";
import AuditCompare from "@/pages/AuditCompare";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/audit-compare")({
  head: () => pageHead({
    title: "Audit Comparé SEO & GEO vs Concurrents | Crawlers.fr",
    description: "Benchmark SEO et GEO vs 3 concurrents. Radar Chart, analyse différentielle, score IAS comparé. Disponible en crédits.",
    path: "/app/audit-compare",
    noIndex: true,
  }),
  component: AuditCompare,
});
