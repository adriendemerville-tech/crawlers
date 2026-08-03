import { createFileRoute } from "@tanstack/react-router";
import Observatoire from "@/pages/Observatoire";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/observatoire")({
  head: () => pageHead({
    title: "French Web SEO & GEO Observatory — 2026",
    description: "Open-data dashboard of French web SEO & GEO statistics: JSON-LD adoption, Core Web Vitals, HTTPS, mobile compatibility. Real-time anonymized data from thousands of Crawlers.fr audits.",
    path: "/observatoire",
    noIndex: true,
  }),
  component: Observatoire,
});
