import { createFileRoute } from "@tanstack/react-router";
import AnalyseSiteWebGratuit from "@/pages/AnalyseSiteWebGratuit";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/analyse-site-web-gratuit")({
  head: () => pageHead({
    title: "Analyse de site web gratuite 2026 — SEO & visibilité IA",
    description: "Analyser un site web gratuitement : SEO technique, Core Web Vitals, visibilité LLM et JSON-LD. Guide complet et outil 2026.",
    path: "/analyse-site-web-gratuit",
    ogType: "article",
    noIndex: true,
  }),
  component: AnalyseSiteWebGratuit,
});
