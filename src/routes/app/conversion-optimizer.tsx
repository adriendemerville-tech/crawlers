import { createFileRoute } from "@tanstack/react-router";
import ConversionOptimizer from "@/pages/ConversionOptimizer";

export const Route = createFileRoute("/app/conversion-optimizer")({
  component: ConversionOptimizer,
});
