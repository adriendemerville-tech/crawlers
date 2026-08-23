import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias anglophone de la page « À propos » — canonique : /a-propos. */
export const Route = createFileRoute("/about")({
  beforeLoad: () => {
    throw redirect({ href: "/a-propos", statusCode: 301, replace: true });
  },
});
