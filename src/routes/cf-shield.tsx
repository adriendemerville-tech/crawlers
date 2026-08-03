import { createFileRoute } from "@tanstack/react-router";
import CfShield from "@/pages/CfShield";

export const Route = createFileRoute("/cf-shield")({
  component: CfShield,
});
