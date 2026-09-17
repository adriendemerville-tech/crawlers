import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { pageHead } from "@/lib/seo/pageHead";
import { buildArticleJsonLd, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";
import { GEO_VS_SEO_FAQ } from "@/pages/GeoVsSeo.seo";

const GeoVsSeo = lazy(() => import("@/pages/GeoVsSeo"));

// Satellite comparatif du silo GEO (pilier : /audit-geo-seo).
// Cible « geo vs seo », « seo vs geo » et « seo et geo » ; la méthode GEO
// détaillée reste sur /generative-engine-optimization (pas de cannibalisation).
const PATH = "/geo-vs-seo";
const TITLE = "GEO vs SEO : pourquoi il ne faut pas les opposer";
const DESCRIPTION =
  "GEO et SEO ne s'opposent pas : les moteurs génératifs citent des pages indexées. Différences réelles, chantiers communs et méthode pour savoir où investir.";

export const Route = createFileRoute("/geo-vs-seo")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      ogType: "article",
      keywords:
        "geo vs seo, seo vs geo, seo et geo, différence seo geo, generative engine optimization, référencement IA",
      jsonLd: [
        buildArticleJsonLd({
          title: TITLE,
          description: DESCRIPTION,
          path: PATH,
          datePublished: "2026-09-17",
          section: "GEO & SEO",
          keywords: "geo vs seo, seo vs geo, seo et geo, generative engine optimization",
        }),
        buildFaqJsonLd(
          GEO_VS_SEO_FAQ.map(([question, answer]) => ({ question, answer })),
        ),
        buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Audit GEO SEO", path: "/audit-geo-seo" },
          { name: "GEO vs SEO", path: PATH },
        ]),
      ],
    }),
  component: GeoVsSeo,
});
