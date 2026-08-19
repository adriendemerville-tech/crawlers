import { createFileRoute } from "@tanstack/react-router";
import AnalyseSiteWebGratuit from "@/pages/AnalyseSiteWebGratuit";
import { pageHead } from "@/lib/seo/pageHead";
import { marinaMentionJsonLd } from "@/lib/seo/marinaMentions";

export const Route = createFileRoute("/analyse-site-web-gratuit")({
  head: () => pageHead({
    title: "Analyse de site web gratuite — audit SEO GEO 220 points",
    description: "Analyser un site gratuitement : rapport de 40 à 100 pages, 18 sections, 220+ points SEO/GEO mesurés et 9 questions posées aux LLM. 2 rapports offerts.",
    path: "/analyse-site-web-gratuit",
    jsonLd: [marinaMentionJsonLd({ path: "/analyse-site-web-gratuit", name: "Analyse de site web gratuite — audit SEO GEO 220 points", description: "Analyser un site gratuitement : rapport de 40 à 100 pages, 18 sections, 220+ points SEO/GEO mesurés et 9 questions posées aux LLM. 2 rapports offerts." })],
    ogType: "article",
  }),
  component: AnalyseSiteWebGratuit,
});
