import { createFileRoute } from "@tanstack/react-router";
import FeaturesCocoon from "@/pages/FeaturesCocoon";

export const Route = createFileRoute("/features/cocoon")({
  component: FeaturesCocoon,
});
