import { createFileRoute } from "@tanstack/react-router";
import AuthorsIndex from "@/pages/AuthorsIndex";

export const Route = createFileRoute("/auteur")({
  component: AuthorsIndex,
});
