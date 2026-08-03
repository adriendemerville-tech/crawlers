import { createFileRoute } from "@tanstack/react-router";
import ArchitectureMapPage from "@/pages/ArchitectureMapPage";

export const Route = createFileRoute("/architecture-map")({
  component: ArchitectureMapPage,
});
