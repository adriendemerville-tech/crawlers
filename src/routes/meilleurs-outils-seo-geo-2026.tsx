import { createFileRoute } from "@tanstack/react-router";
import MeilleursOutilsSeoGeo2026 from "@/pages/MeilleursOutilsSeoGeo2026";
import { OUTILS_JSONLD } from "@/pages/MeilleursOutilsSeoGeo2026.seo";
import { pageHead } from "@/lib/seo/pageHead";

// Satellite du silo « Comparatifs » (pilier : /comparatif-crawlers-semrush).
export const Route = createFileRoute("/meilleurs-outils-seo-geo-2026")({
  head: () =>
    pageHead({
      title: "Meilleurs outils SEO et GEO 2026 : 11 alternatives à Semrush et Ahrefs",
      description:
        "SE Ranking, Crawlers.fr, Surfer SEO, ThotSEO, SoRank, Outrank, ChatSEO, Cocolyze, BotSEO, Localo : classement 2026 des nouveaux outils SEO et GEO, comparatif et prix.",
      path: "/meilleurs-outils-seo-geo-2026",
      ogType: "article",
      jsonLd: OUTILS_JSONLD,
    }),
  component: MeilleursOutilsSeoGeo2026,
});
