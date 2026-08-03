import { createFileRoute } from "@tanstack/react-router";
import ContentArchitectPage from "@/pages/ContentArchitectPage";

export const Route = createFileRoute("/content-architect")({
  component: ContentArchitectPage,
});
