import { createFileRoute } from "@tanstack/react-router";
import ProAgency from "@/pages/ProAgency";

export const Route = createFileRoute("/pro-agency")({
  component: ProAgency,
});
