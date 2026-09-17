import { createFileRoute, redirect } from "@tanstack/react-router";

// 301 vers la page comparative canonique.
export const Route = createFileRoute("/blog/geo-vs-seo")({
  beforeLoad: () => {
    throw redirect({ href: "/geo-vs-seo", statusCode: 301, replace: true });
  },
});
