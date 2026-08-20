import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : "référencement IA" est désormais porté par
// le pilier GEO unique (titre et FAQ absorbés). 301 permanent.
export const Route = createFileRoute("/referencement-ia")({
  beforeLoad: () => {
    throw redirect({
      href: "/generative-engine-optimization",
      statusCode: 301,
      replace: true,
    });
  },
});
