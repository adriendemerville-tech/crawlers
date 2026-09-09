import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { pillarJsonLd } from "@/lib/seo/pillarJsonLd";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/seo-avec-claude")({
  head: () => {
    const pillar = KEYWORD_PILLARS["seo-avec-claude"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/seo-avec-claude",
      ogType: "article",
      jsonLd: pillarJsonLd("seo-avec-claude"),
      keywords: "SEO avec Claude, Claude Code SEO, MCP SEO, audit SEO MCP",
    });
  },
  component: KeywordPillarPage,
});
