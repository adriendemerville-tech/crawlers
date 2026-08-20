import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : quasi-doublon du pilier GEO → 301 permanent.
export const Route = createFileRoute("/outil-geo-ia")({
  beforeLoad: () => {
    throw redirect({
      href: "/generative-engine-optimization",
      statusCode: 301,
      replace: true,
    });
  },
});
