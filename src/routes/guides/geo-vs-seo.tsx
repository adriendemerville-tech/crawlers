import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/geo-vs-seo")({
  beforeLoad: () => {
    throw redirect({ href: "/generative-engine-optimization", replace: true });
  },
});
