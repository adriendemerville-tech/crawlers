import { createFileRoute } from "@tanstack/react-router";
import FeaturesConsole from "@/pages/FeaturesConsole";

export const Route = createFileRoute("/features/console")({
  component: FeaturesConsole,
});
