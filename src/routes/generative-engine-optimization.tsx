import { createFileRoute } from "@tanstack/react-router";
import GenerativeEngineOptimization from "@/pages/GenerativeEngineOptimization";

export const Route = createFileRoute("/generative-engine-optimization")({
  component: GenerativeEngineOptimization,
});
