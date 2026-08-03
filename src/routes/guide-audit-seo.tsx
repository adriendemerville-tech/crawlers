import { createFileRoute } from "@tanstack/react-router";
import GuideAuditSeo from "@/pages/GuideAuditSeo";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/guide-audit-seo")({
  head: () => pageHead({
    title: "Audit SEO & GEO 2026 : Guide Identity-First Complet",
    description: "Guide exhaustif pour réaliser un audit SEO/GEO en 2026. Méthodologie Identity-First de Crawlers.fr : 168 critères, Score GEO, visibilité LLM, Cocoon 3D.",
    path: "/guide-audit-seo",
    ogType: "article",
  }),
  component: GuideAuditSeo,
});
