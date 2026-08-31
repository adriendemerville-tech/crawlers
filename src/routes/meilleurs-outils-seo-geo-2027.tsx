import { createFileRoute } from "@tanstack/react-router";
import MeilleursOutilsSeoGeo2027 from "@/pages/MeilleursOutilsSeoGeo2027";
import { OUTILS_JSONLD } from "@/pages/MeilleursOutilsSeoGeo2027.seo";
import { pageHead } from "@/lib/seo/pageHead";

// Satellite du silo « Comparatifs » (pilier : /comparatif-crawlers-semrush).
export const Route = createFileRoute("/meilleurs-outils-seo-geo-2027")({
  head: () =>
    pageHead({
      title: "Meilleurs outils SEO et GEO 2027 : le classement des 15 suites",
      description:
        "SE Ranking, Crawlers.fr, Surfer SEO, ThotSEO, SoRank, Outrank, ChatSEO, Cocolyze, BotSEO, Localo, Semrush, Ahrefs, Qwairy, Peak Ace : classement 2027 des outils SEO et GEO, comparatif, prix et analyse détaillée.",
      path: "/meilleurs-outils-seo-geo-2027",
      ogType: "article",
      jsonLd: OUTILS_JSONLD,
    }),
  component: MeilleursOutilsSeoGeo2027,
});
