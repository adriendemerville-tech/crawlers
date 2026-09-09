import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { pillarJsonLd } from "@/lib/seo/pillarJsonLd";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/visibilite-ia")({
  head: () => {
    const pillar = KEYWORD_PILLARS["visibilite-ia"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/visibilite-ia",
      ogType: "article",
      jsonLd: pillarJsonLd("visibilite-ia"),
      keywords: "visibilité IA, citations ChatGPT, visibilité LLM, GEO",
    });
  },
  component: KeywordPillarPage,
});
