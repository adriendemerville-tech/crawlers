import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : quasi-doublon du pilier GEO → 301 permanent.
export const Route = createFileRoute("/visibilite-llm")({
  beforeLoad: () => {
    throw redirect({
      href: "/generative-engine-optimization",
      statusCode: 301,
      replace: true,
    });
  },
});
