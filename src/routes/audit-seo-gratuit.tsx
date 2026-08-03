import { createFileRoute } from "@tanstack/react-router";
import AuditSeoGratuit from "@/pages/AuditSeoGratuit";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/audit-seo-gratuit")({
  head: () => pageHead({
    title: "Audit SEO gratuit 2026 — 200 points & visibilité IA",
    description: "Audit SEO gratuit sur 200 points : Core Web Vitals, JSON-LD, robots.txt, visibilité LLM. Résultats en 2 min, code correctif inclus.",
    path: "/audit-seo-gratuit",
  }),
  component: AuditSeoGratuit,
});
