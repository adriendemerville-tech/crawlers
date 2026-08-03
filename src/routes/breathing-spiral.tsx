import { createFileRoute } from "@tanstack/react-router";
import BreathingSpiral from "@/pages/BreathingSpiral";

export const Route = createFileRoute("/breathing-spiral")({
  component: BreathingSpiral,
});
