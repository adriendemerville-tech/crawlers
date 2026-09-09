import { createFileRoute } from "@tanstack/react-router";
import GeoMcpServer from "@/pages/GeoMcpServer";
import { pageHead } from "@/lib/seo/pageHead";
import { breadcrumbList } from "@/lib/seo/breadcrumb";

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
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Qu’est-ce qu’un serveur MCP pour le GEO ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Un serveur Model Context Protocol qui expose la mesure de la visibilité IA sous forme d’outils appelables : un agent de développement peut vérifier si ChatGPT, Gemini, Perplexity ou Claude citent vos pages, puis demander les corrections et re-mesurer.",
              },
            },
            {
              "@type": "Question",
              name: "Quelle différence avec un audit GEO classique ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "L’audit classique produit un rapport ponctuel. Le serveur MCP rend la mesure appelable en boucle par un agent : mesurer, corriger, re-mesurer, avec un identifiant de constat stable dont la disparition prouve la résolution.",
              },
            },
            {
              "@type": "Question",
              name: "Comment est-ce facturé ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Les lectures et les statuts de jobs sont gratuits. Les outils qui déclenchent un crawl ou un calcul consomment d’abord le quota de votre plan, puis votre portefeuille développeur en paiement à l’usage, avec un plafond journalier.",
              },
            },
          ],
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
