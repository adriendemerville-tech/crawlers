import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/audit-seo-geo")({
  head: () => {
    const pillar = KEYWORD_PILLARS["audit-seo-geo"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/audit-seo-geo",
      jsonLd: [marinaMentionJsonLd({ path: "/audit-seo-geo", name: pillar.title, description: pillar.metaDesc })],
      ogType: "article",
    });
  },
  component: KeywordPillarPage,
});
