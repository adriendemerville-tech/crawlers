import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : /score-geo était un quasi-doublon (450 mots)
// du pilier GEO. 301 permanent vers le pilier unique.
export const Route = createFileRoute("/score-geo")({
  beforeLoad: () => {
    throw redirect({
      href: "/generative-engine-optimization",
      statusCode: 301,
      replace: true,
    });
  },
});
