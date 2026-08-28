import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : promesse identique à /audit-seo-gratuit → 301 permanent.
export const Route = createFileRoute("/analyse-site-web-gratuit")({
  beforeLoad: () => {
    throw redirect({
      href: "/audit-seo-gratuit",
      statusCode: 301,
      replace: true,
    });
  },
});
