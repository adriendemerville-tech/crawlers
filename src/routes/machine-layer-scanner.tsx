import { createFileRoute } from "@tanstack/react-router";
import MachineLayerLanding from "@/pages/MachineLayerLanding";

export const Route = createFileRoute("/machine-layer-scanner")({
  component: MachineLayerLanding,
});
