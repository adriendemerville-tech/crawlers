import { createFileRoute } from "@tanstack/react-router";
import SeaSeoBridge from "@/pages/SeaSeoBridge";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/sea-seo-bridge")({
  head: () => pageHead({
    title: "SEA SEO Bridge — croisement Google Ads & SEO par IA",
    description: "Identifiez les mots-clés SEA convertibles en trafic SEO. L'IA croise Google Ads, Search Console et GA4 pour révéler les opportunités.",
    path: "/sea-seo-bridge",
    noIndex: true,
  }),
  component: SeaSeoBridge,
});
