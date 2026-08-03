import { createFileRoute } from "@tanstack/react-router";
import ExpertAudit from "@/pages/ExpertAudit";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/audit-expert")({
  head: () => pageHead({
    title: "Audit SEO & GEO expert — check-up technique complet",
    description: "Audit SEO et GEO par un expert : Core Web Vitals, citabilité ChatGPT/Claude/Perplexity, JSON-LD et code correctif. Check-up en 2 min.",
    path: "/audit-expert",
  }),
  component: ExpertAudit,
});
