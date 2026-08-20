import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation de cannibalisation : la sémantique "crawler IA" est portée par
// l'article de référence qui ranke déjà (P8). 301 permanent.
export const Route = createFileRoute("/crawler-ia")({
  beforeLoad: () => {
    throw redirect({
      href: "/blog/crawler-definition-seo-geo",
      statusCode: 301,
      replace: true,
    });
  },
});
