import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { pillarJsonLd } from "@/lib/seo/pillarJsonLd";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/audit-seo-par-ia")({
  head: () => {
    const pillar = KEYWORD_PILLARS["audit-seo-par-ia"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/audit-seo-par-ia",
      ogType: "article",
      jsonLd: pillarJsonLd("audit-seo-par-ia"),
      keywords: "audit SEO par IA, audit SEO automatique, audit GEO",
    });
  },
  component: KeywordPillarPage,
});
