import { createFileRoute } from "@tanstack/react-router";
import AuditSeoGratuit from "@/pages/AuditSeoGratuit";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/audit-seo-gratuit")({
  head: () => pageHead({
    title: "Audit SEO gratuit 2026 — rapport complet 220 points",
    description: "Audit SEO et GEO gratuit : rapport de 40 à 100 pages, 18 sections, 220+ points mesurés et 9 questions posées aux IA. 2 rapports offerts, sans compte.",
    path: "/audit-seo-gratuit",
    jsonLd: [marinaMentionJsonLd({ path: "/audit-seo-gratuit", name: "Audit SEO gratuit 2026 — rapport complet 220 points", description: "Audit SEO et GEO gratuit : rapport de 40 à 100 pages, 18 sections, 220+ points mesurés et 9 questions posées aux IA. 2 rapports offerts, sans compte." })],
  }),
  component: AuditSeoGratuit,
});
