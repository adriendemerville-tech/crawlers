import { createFileRoute } from "@tanstack/react-router";
import ConversionOptimizer from "@/pages/ConversionOptimizer";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/conversion-optimizer")({
  head: () => pageHead({
    title: "Conversion Optimizer | Crawlers",
    description: "Analysez l'UX de vos pages en contexte business pour optimiser le ton, les CTA et la conversion.",
    path: "/app/conversion-optimizer",
    noIndex: true,
  }),
  component: ConversionOptimizer,
});
