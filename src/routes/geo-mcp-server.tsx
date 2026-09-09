import { createFileRoute } from "@tanstack/react-router";
import GeoMcpServer from "@/pages/GeoMcpServer";
import { pageHead } from "@/lib/seo/pageHead";

const TITLE = "Serveur MCP GEO : mesurez votre visibilité IA | Crawlers";
const DESCRIPTION =
  "Un serveur MCP qui donne aux agents IA un vrai moteur de mesure GEO : citations dans ChatGPT, Gemini, Perplexity et Claude, constats normalisés, corrections et re-mesure.";

export const Route = createFileRoute("/geo-mcp-server")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/geo-mcp-server",
      ogType: "article",
      keywords:
        "geo mcp server, serveur mcp geo, mcp visibilité ia, model context protocol seo, claude code seo",
      extraMeta: [{ property: "og:locale", content: "fr_FR" }],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "Serveur MCP GEO : mesurez votre visibilité IA depuis votre agent",
          description: DESCRIPTION,
          inLanguage: "fr",
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
          mainEntityOfPage: "https://crawlers.fr/geo-mcp-server",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: "https://crawlers.fr/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Serveur MCP GEO",
              item: "https://crawlers.fr/geo-mcp-server",
            },
          ],
        },
      ],
    }),
  component: GeoMcpServer,
});
