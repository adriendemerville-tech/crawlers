import { createFileRoute } from "@tanstack/react-router";
import IndiceAlignementStrategique from "@/pages/IndiceAlignementStrategique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/indice-alignement-strategique")({
  head: () => pageHead({
    title: "IAS — Índice de Alineamiento Estratégico SEO & GEO 2026",
    description: "El Índice de Alineamiento Estratégico (IAS) de Crawlers.fr transforma sus datos de Google Search Console en un diagnóstico multidimensional. 4 sub-scores, detección automática de antigüedad, diagnóstico IA.",
    path: "/indice-alignement-strategique",
    ogType: "article",
    noIndex: true,
  }),
  component: IndiceAlignementStrategique,
});
