import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/site-crawl")({
  beforeLoad: () => {
    throw redirect({ href: "/app/site-crawl", replace: true });
  },
});
