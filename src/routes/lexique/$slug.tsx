import { createFileRoute } from "@tanstack/react-router";
import ExpertTermPage from "@/pages/Lexique/ExpertTermPage";

export const Route = createFileRoute("/lexique/$slug")({
  component: ExpertTermPage,
});
