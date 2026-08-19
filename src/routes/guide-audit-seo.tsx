import { createFileRoute } from "@tanstack/react-router";
import GuideAuditSeo from "@/pages/GuideAuditSeo";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/guide-audit-seo")({
  head: () => pageHead({
    title: "Audit SEO & GEO 2026 : guide complet + audit gratuit",
    description: "Guide d'audit SEO/GEO 2026 (méthode Identity-First) et audit gratuit Marina : 40 à 100 pages, 18 sections, 220+ points mesurés, 9 questions aux IA.",
    path: "/guide-audit-seo",
    jsonLd: [marinaMentionJsonLd({ path: "/guide-audit-seo", name: "Audit SEO & GEO 2026 : guide complet + audit gratuit", description: "Guide d'audit SEO/GEO 2026 (méthode Identity-First) et audit gratuit Marina : 40 à 100 pages, 18 sections, 220+ points mesurés, 9 questions aux IA." })],
    ogType: "article",
  }),
  component: GuideAuditSeo,
});
