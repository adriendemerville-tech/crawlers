import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auteur/adrien")({
  beforeLoad: () => {
    throw redirect({ href: "/auteur/adrien-de-volontat", replace: true });
  },
});
