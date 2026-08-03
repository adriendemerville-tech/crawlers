import { createFileRoute } from "@tanstack/react-router";
import AuditSemantique from "@/pages/AuditSemantique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/audit-semantique")({
  head: () => pageHead({
    title: "Semantic SEO Audit — Analyze Your Content Depth | Crawlers.fr",
    description: "Run a free semantic audit on your website. Evaluate content depth, keyword coverage, thematic gaps and E-E-A-T signals with Crawlers.fr AI engine.",
    path: "/audit-semantique",
  }),
  component: AuditSemantique,
});
