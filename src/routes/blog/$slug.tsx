import { createFileRoute } from "@tanstack/react-router";
import ArticlePage from "@/pages/Blog/ArticlePage";

export const Route = createFileRoute("/blog/$slug")({
  component: ArticlePage,
});
