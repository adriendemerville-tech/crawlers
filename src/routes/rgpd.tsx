import { createFileRoute } from "@tanstack/react-router";
import RGPD from "@/pages/RGPD";

export const Route = createFileRoute("/rgpd")({
  component: RGPD,
});
