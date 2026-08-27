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
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: "https://crawlers.fr/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Generative Engine Optimization",
              item: "https://crawlers.fr/generative-engine-optimization",
            },
            { "@type": "ListItem", position: 3, name: "Audit GEO", item: "https://crawlers.fr/audit-geo" },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Méthode d'audit GEO Crawlers.fr : mesurer d'abord, interpréter ensuite",
          description:
            "La donnée est collectée par crawl et par sources SERP/backlinks, historisée par URL, puis interprétée par l'IA. Aucun chiffre du rapport ne provient d'un modèle de langage.",
          tool: [{ "@type": "HowToTool", name: "Crawlers.fr" }],
          step: [
            {
              "@type": "HowToStep",
              position: 1,
              name: "Crawl du rendu servi aux robots",
              text: "La page est récupérée telle qu'un robot la reçoit, JavaScript compris, pour mesurer le texte réellement accessible et détecter une coquille JS.",
            },
            {
              "@type": "HowToStep",
              position: 2,
              name: "Collecte des données de marché",
              text: "Positions SERP, volumes, concurrents réellement identifiés et profil de backlinks segmenté sont récupérés depuis des sources de données, jamais devinés.",
            },
            {
              "@type": "HowToStep",
              position: 3,
              name: "Historisation par URL",
              text: "Chaque mesure est conservée en mémoire par page afin de croiser les signaux et suivre l'évolution du référencement dans le temps.",
            },
            {
              "@type": "HowToStep",
              position: 4,
              name: "Interprétation par l'IA",
              text: "Les modèles calculent des probabilités de citation, hiérarchisent les priorités et rédigent le verdict à partir des faits déjà mesurés.",
            },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Pourquoi ne pas demander directement un audit à ChatGPT ou Claude ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Un modèle de langage ne crawle pas la page entière ni ses ressources, n'accède pas aux SERP en temps réel, ne connaît pas le profil de backlinks, ne garde aucune mémoire d'un audit à l'autre et change d'appréciation à chaque exécution : le diagnostic est imprédictible. Crawlers.fr mesure d'abord la donnée réelle, la conserve, puis n'utilise l'IA que pour calculer des probabilités et rédiger l'analyse.",
              },
            },
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
