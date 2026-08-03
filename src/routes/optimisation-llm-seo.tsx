import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/optimisation-llm-seo")({
  head: () => {
    const pillar = KEYWORD_PILLARS["optimisation-llm-seo"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/optimisation-llm-seo",
      ogType: "article",
    });
  },
  component: KeywordPillarPage,
});
