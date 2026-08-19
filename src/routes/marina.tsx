import { createFileRoute } from "@tanstack/react-router";
import MarinaPage from "@/pages/Marina";
import { pageHead } from "@/lib/seo/pageHead";

const URL = "https://crawlers.fr/marina";

const FAQ: Array<[string, string]> = [
  ["L'audit Marina est-il vraiment gratuit ?", "Oui. Les 2 premiers rapports sont offerts, sans carte bancaire ni abonnement : une adresse e-mail suffit. Au-delà, un rapport coûte 5 crédits."],
  ["Que contient le rapport d'audit SEO GEO gratuit ?", "40 pages et plus, une vingtaine de sous-audits : SEO technique (Core Web Vitals, robots.txt, sitemap, canonicals, JSON-LD, maillage interne, duplication, thin content), visibilité GEO mesurée, E-E-A-T, cocoon sémantique, mots-clés et quick wins, puis un plan d'action priorisé."],
  ["Comment la visibilité dans les IA est-elle mesurée ?", "Marina envoie 9 questions réelles (3 axes × 3 formulations) à ChatGPT, Gemini, Perplexity, Claude et Mistral et compte les citations obtenues. Chaque donnée est étiquetée Mesuré, Testé, Déduit ou Estimé."],
  ["Combien de temps prend un audit ?", "Environ 3 à 5 minutes, jusqu'à 10 000 URLs explorées sur les grands sites. Rapport consultable en ligne et exportable en PDF."],
  ["En quoi est-ce différent d'un audit demandé à ChatGPT ou Claude ?", "Un LLM seul ne crawle pas le site à l'échelle, n'a pas accès aux volumes de recherche ni aux positions SERP réelles, et ne peut pas interroger les autres moteurs pour mesurer un taux de citation."],
  ["Marina est-il disponible pour les professionnels ?", "Oui : marque blanche pour les comptes Pro Agency, et automatisation via l'API REST Crawlers et le serveur MCP."],
];

export const Route = createFileRoute("/marina")({
  head: () =>
    pageHead({
      title: "Audit SEO GEO gratuit — 40 pages, 2 rapports offerts | Marina",
      description:
        "Audit SEO et GEO gratuit : 2 rapports offerts sans carte bancaire. 40+ pages, ~20 sous-audits, visibilité mesurée dans ChatGPT, Gemini, Perplexity, Claude et Mistral, plan d'action priorisé.",
      path: "/marina",
      keywords:
        "audit seo geo gratuit, audit seo gratuit, audit gratuit référencement, audit visibilité IA, audit GEO",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Marina — audit SEO & GEO gratuit",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: URL,
          description:
            "Audit SEO et GEO gratuit de plus de 40 pages : crawl technique, visibilité mesurée dans les moteurs génératifs (ChatGPT, Gemini, Perplexity, Claude, Mistral) et plan d'action priorisé.",
          featureList: [
            "Crawl technique jusqu'à 10 000 URLs",
            "9 questions réelles posées à 5 moteurs génératifs",
            "Score GEO décomposé en sous-signaux (compréhension machine, autorité perçue)",
            "Détection duplication proche et contenu pauvre",
            "Plan d'action priorisé impact / effort",
            "Export PDF et API / MCP",
          ],
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            description: "2 rapports d'audit SEO GEO offerts, sans carte bancaire",
            url: URL,
          },
          provider: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
          mainEntityOfPage: URL,
        },
        {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Obtenir un audit SEO GEO gratuit",
          totalTime: "PT5M",
          estimatedCost: { "@type": "MonetaryAmount", currency: "EUR", value: "0" },
          step: [
            { "@type": "HowToStep", name: "Saisir l'URL du site", text: "Entrez l'adresse du site à auditer sur https://crawlers.fr/marina.", url: URL },
            { "@type": "HowToStep", name: "Renseigner un e-mail", text: "Une adresse e-mail suffit pour les 2 rapports offerts, sans carte bancaire.", url: URL },
            { "@type": "HowToStep", name: "Lancer l'audit", text: "Marina crawle le site, mesure les signaux techniques et interroge 5 moteurs génératifs.", url: URL },
            { "@type": "HowToStep", name: "Consulter le rapport", text: "Le rapport de 40+ pages est consultable en ligne, exportable en PDF et partageable par lien court.", url: URL },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        },
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: URL,
          name: "Audit SEO GEO gratuit — Marina",
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["h1", ".citable-passage"],
          },
        },
      ],
    }),
  component: MarinaPage,
});
