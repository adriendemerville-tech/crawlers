import { createFileRoute } from "@tanstack/react-router";
import Tarifs from "@/pages/Tarifs";

export const Route = createFileRoute("/tarifs")({
  component: Tarifs,
});
