import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rapport/matrice")({
  beforeLoad: () => {
    throw redirect({ href: "/app/rapport/matrice", replace: true });
  },
});
