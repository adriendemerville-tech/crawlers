import { createFileRoute } from "@tanstack/react-router";
import ConversionOptimizerLanding from "@/pages/ConversionOptimizerLanding";

export const Route = createFileRoute("/conversion-optimizer")({
  component: ConversionOptimizerLanding,
});
