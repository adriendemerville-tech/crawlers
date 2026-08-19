import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/outil-geo-ia")({
  head: () => {
    const pillar = KEYWORD_PILLARS["outil-geo-ia"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/outil-geo-ia",
      jsonLd: [marinaMentionJsonLd({ path: "/outil-geo-ia", name: pillar.title, description: pillar.metaDesc })],
      ogType: "article",
    });
  },
  component: KeywordPillarPage,
});
