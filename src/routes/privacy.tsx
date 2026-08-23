import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias anglophone de la politique de confidentialité — canonique : /politique-confidentialite. */
export const Route = createFileRoute("/privacy")({
  beforeLoad: () => {
    throw redirect({ href: "/politique-confidentialite", statusCode: 301, replace: true });
  },
});
