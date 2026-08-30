import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirection 301 : la page a été repositionnée sur 2027.
export const Route = createFileRoute("/meilleurs-outils-seo-geo-2026")({
  beforeLoad: () => {
    throw redirect({
      to: "/meilleurs-outils-seo-geo-2027",
      statusCode: 301,
    });
  },
});
