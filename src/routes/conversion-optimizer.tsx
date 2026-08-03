import { createFileRoute } from "@tanstack/react-router";
import ConversionOptimizerLanding from "@/pages/ConversionOptimizerLanding";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/conversion-optimizer")({
  head: () => pageHead({
    title: "Conversion Optimizer : audit CRO & taux de conversion IA",
    description: "Optimisation du taux de conversion par IA : analyse ton, CTAs, lisibilité et potentiel CRO de chaque page selon votre contexte business.",
    path: "/conversion-optimizer",
    noIndex: true,
  }),
  component: ConversionOptimizerLanding,
});
