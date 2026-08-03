import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/crawler-ia")({
  head: () => {
    const pillar = KEYWORD_PILLARS["crawler-ia"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/crawler-ia",
      ogType: "article",
    });
  },
  component: KeywordPillarPage,
});
