import { createFileRoute } from "@tanstack/react-router";
import IndiceAlignementStrategique from "@/pages/IndiceAlignementStrategique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/indice-alignement-strategique")({
  head: () => pageHead({
    title: "IAS — Indice d'Alignement Stratégique SEO & GEO 2026",
    description: "L'Indice d'Alignement Stratégique transforme vos données Search Console en diagnostic : 4 sous-scores, détection d'ancienneté, causes de la baisse de trafic.",
    path: "/indice-alignement-strategique",
    ogType: "article",
    noIndex: true,
  }),
  component: IndiceAlignementStrategique,
});
