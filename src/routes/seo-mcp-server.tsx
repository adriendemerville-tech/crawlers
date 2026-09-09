import { createFileRoute } from "@tanstack/react-router";
import SeoMcpServer from "@/pages/SeoMcpServer";
import { pageHead } from "@/lib/seo/pageHead";
import { breadcrumbList } from "@/lib/seo/breadcrumb";

const TITLE = "SEO MCP Server for Claude & Cursor | Crawlers";
const DESCRIPTION =
  "An MCP server that gives AI coding agents a real SEO audit engine: crawl, normalised findings, stack-specific fixes and verification. Claude Code, Claude Desktop, Cursor.";

export const Route = createFileRoute("/seo-mcp-server")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/seo-mcp-server",
      ogType: "article",
      keywords: "seo mcp server, mcp server seo, model context protocol seo, claude code seo",
      extraMeta: [{ property: "og:locale", content: "en_US" }],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "SEO MCP server: give your coding agent a real audit engine",
          description: DESCRIPTION,
          inLanguage: "en",
          datePublished: "2026-09-09",
          dateModified: "2026-09-09",
          author: {
            "@type": "Person",
            name: "Adrien de Volontat",
            url: "https://crawlers.fr/auteur/adrien-de-volontat",
          },
          publisher: {
            "@type": "Organization",
            name: "Crawlers.fr",
            url: "https://crawlers.fr",
          },
          mainEntityOfPage: "https://crawlers.fr/seo-mcp-server",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://crawlers.fr/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "SEO MCP server",
              item: "https://crawlers.fr/seo-mcp-server",
            },
          ],
        },
      ],
    }),
  component: SeoMcpServer,
});
