import { createFileRoute } from "@tanstack/react-router";
import Aide from "@/pages/Aide";

export const Route = createFileRoute("/aide")({
  component: Aide,
});
