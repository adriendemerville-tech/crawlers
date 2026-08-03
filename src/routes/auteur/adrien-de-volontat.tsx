import { createFileRoute } from "@tanstack/react-router";
import AuthorPage from "@/pages/AuthorPage";

export const Route = createFileRoute("/auteur/adrien-de-volontat")({
  component: AuthorPage,
});
