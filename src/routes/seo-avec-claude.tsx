import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";
import { pageHead } from "@/lib/seo/pageHead";
import { KEYWORD_PILLARS } from "@/data/keywordPillars";

export const Route = createFileRoute("/seo-avec-claude")({
  head: () => {
    const pillar = KEYWORD_PILLARS["seo-avec-claude"];
    return pageHead({
      title: pillar.title,
      description: pillar.metaDesc,
      path: "/seo-avec-claude",
      ogType: "article",
      keywords: "SEO avec Claude, Claude Code SEO, MCP SEO, audit SEO MCP",
    });
  },
  component: KeywordPillarPage,
});
