import { createFileRoute } from "@tanstack/react-router";
import MachineLayerScanner from "@/pages/MachineLayerScanner";

export const Route = createFileRoute("/app/machine-layer")({
  component: MachineLayerScanner,
});
