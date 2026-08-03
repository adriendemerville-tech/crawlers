import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/geo-vs-seo")({
  beforeLoad: () => {
    throw redirect({ href: "/blog/comprendre-geo-vs-seo", replace: true });
  },
});
