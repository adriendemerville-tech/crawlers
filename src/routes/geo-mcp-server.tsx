import { createFileRoute } from "@tanstack/react-router";
import GeoMcpServer from "@/pages/GeoMcpServer";
import { pageHead } from "@/lib/seo/pageHead";
import { breadcrumbList } from "@/lib/seo/breadcrumb";

const TITLE = "Serveur MCP GEO : mesurez votre visibilité IA | Crawlers";
const DESCRIPTION =
  "Serveur MCP GEO : check_geo_score, check_llm_visibility (ChatGPT, Gemini, Perplexity, Claude) et check_ai_crawlers, parmi les 27 outils de mcp-server 1.2.0.";

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
                text: "L’audit classique produit un rapport ponctuel. Le serveur MCP rend la mesure appelable par un agent. expert_seo_audit et strategic_ai_audit renvoient un job_id à suivre avec get_audit_job ; sync: true force le mode bloquant.",
              },
            },
            {
              "@type": "Question",
              name: "Comment est-ce facturé ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "L’endpoint opérationnel enregistre 27 outils (mcp-server 1.2.0) : 3 sans clé, 12 Pro Agency (dont keyword_research, serp_ranking et backlink_snapshot), get_audit_job authentifié et gratuit, 4 outils Marina, et 7 outils Search Console en lecture seule réservés aux administrateurs. Un rapport Marina coûte 5 crédits, ou est inclus avec Pro Agency actif. Un solde insuffisant renvoie JSON-RPC -32002 sans créer de job.",
              },
            },
          ],
        },
        {
          "@context": "https://schema.org",
          ...breadcrumbList([
            { name: "Accueil", url: "https://crawlers.fr/" },
            { name: "Serveur MCP GEO", url: "https://crawlers.fr/geo-mcp-server" },
          ]),
        },
      ],
    }),
  component: GeoMcpServer,
});
