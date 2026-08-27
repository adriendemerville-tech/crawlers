import { createFileRoute } from "@tanstack/react-router";
import AuditGeo from "@/pages/AuditGeo";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";
import { ORGANIZATION_REF } from "@/lib/seo/organization";

const TITLE = "Audit GEO gratuit — 232 points de contrôle | Crawlers.fr";
const DESC =
  "Audit GEO automatisé et gratuit : audit technique complet de votre référencement IA sur 232 points et 11 sous-signaux. Citations ChatGPT, Claude, Perplexity mesurées.";

export const Route = createFileRoute("/audit-geo")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESC,
      path: "/audit-geo",
      jsonLd: [
        marinaMentionJsonLd({ path: "/audit-geo", name: TITLE, description: DESC }),
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Crawlers.fr — Audit GEO",
          applicationCategory: "WebApplication",
          operatingSystem: "Web Browser",
          url: "https://crawlers.fr/audit-geo",
          publisher: ORGANIZATION_REF,
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Qui peut faire un audit GEO sérieux ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Un audit GEO sérieux repose sur des faits mesurés : recrawl du rendu servi aux robots d'IA, contrôle du nœud d'identité JSON-LD, lecture de la politique robots pour GPTBot, ClaudeBot et PerplexityBot, puis interrogation de plusieurs modèles pour vérifier les citations de la marque.",
              },
            },
            {
              "@type": "Question",
              name: "Comment savoir si mon entreprise apparaît dans ChatGPT ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "L'audit pose des questions naturelles d'acheteur à ChatGPT, Claude, Gemini, Perplexity et Mistral, puis compte les citations de votre marque et de vos concurrents. Une absence totale de citation applique une pénalité de 10 % au score GEO, explicitée dans le rapport.",
              },
            },
            {
              "@type": "Question",
              name: "L'audit GEO est-il gratuit ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Oui : les deux premiers rapports sont offerts sans carte bancaire, et un rapport d'exemple est consultable sans compte.",
              },
            },
          ],
        },
      ],
    }),
  component: AuditGeo,
});
