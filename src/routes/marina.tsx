import { createFileRoute } from "@tanstack/react-router";
import MarinaPage from "@/pages/Marina";

export const Route = createFileRoute("/marina")({
  component: MarinaPage,
});
