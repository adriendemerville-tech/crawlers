import { createFileRoute } from "@tanstack/react-router";
import DevLanding from "@/pages/developers/DevLanding";

export const Route = createFileRoute("/developers/")({
  component: DevLanding,
});
