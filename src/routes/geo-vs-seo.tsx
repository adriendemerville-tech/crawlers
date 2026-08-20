import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/geo-vs-seo")({
  beforeLoad: () => {
    throw redirect({ href: "/generative-engine-optimization", statusCode: 301, replace: true });
  },
});
