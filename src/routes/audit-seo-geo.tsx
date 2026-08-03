import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/audit-seo-geo")({
  head: () => {
    const pillar = KEYWORD_PILLARS["audit-seo-geo"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/audit-seo-geo",
      ogType: "article",
    });
  },
  component: KeywordPillarPage,
});
