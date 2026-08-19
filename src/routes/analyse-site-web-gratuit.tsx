import { createFileRoute } from "@tanstack/react-router";
import AnalyseSiteWebGratuit from "@/pages/AnalyseSiteWebGratuit";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/analyse-site-web-gratuit")({
  head: () => pageHead({
    title: "Audit SEO + GEO gratuit — analyse de site web complète",
    description: "Audit SEO + GEO gratuit : rapport de 40 à 100 pages, 18 sections, 220+ points mesurés et 9 questions posées aux LLM. 2 audits offerts.",
    path: "/analyse-site-web-gratuit",
    noIndex: false,
    jsonLd: [marinaMentionJsonLd({ path: "/analyse-site-web-gratuit", name: "Audit SEO + GEO gratuit — analyse de site web complète", description: "Audit SEO + GEO gratuit : rapport de 40 à 100 pages, 18 sections, 220+ points mesurés et 9 questions posées aux LLM. 2 audits offerts." })],
    ogType: "article",
  }),
  component: AnalyseSiteWebGratuit,
});
