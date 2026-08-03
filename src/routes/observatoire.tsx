import { createFileRoute } from "@tanstack/react-router";
import Observatoire from "@/pages/Observatoire";

export const Route = createFileRoute("/observatoire")({
  component: Observatoire,
});
