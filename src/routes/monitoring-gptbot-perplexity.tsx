import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { pillarJsonLd } from "@/lib/seo/pillarJsonLd";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/monitoring-gptbot-perplexity")({
  head: () => {
    const pillar = KEYWORD_PILLARS["monitoring-gptbot-perplexity"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/monitoring-gptbot-perplexity",
      ogType: "article",
      jsonLd: pillarJsonLd("monitoring-gptbot-perplexity"),
    });
  },
  component: KeywordPillarPage,
});
