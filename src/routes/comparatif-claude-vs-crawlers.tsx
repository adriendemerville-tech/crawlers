import { createFileRoute } from "@tanstack/react-router";
import ComparatifClaudeVsCrawlers from "@/pages/ComparatifClaudeVsCrawlers";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-claude-vs-crawlers")({
  head: () => pageHead({
    title: "Claude Code & MCP vs Crawlers.fr — comparatif SEO/GEO",
    description: "Claude Cowork, Claude Code et MCP vs Crawlers.fr : 14 critères pour freelances SEO. Pourquoi 29€/mois remplacent votre stack Claude.",
    path: "/comparatif-claude-vs-crawlers",
    ogType: "article",
  }),
  component: ComparatifClaudeVsCrawlers,
});
