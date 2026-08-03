import { createFileRoute } from "@tanstack/react-router";
import AppEeat from "@/pages/AppEeat";

export const Route = createFileRoute("/app/eeat")({
  component: AppEeat,
});
