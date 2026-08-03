import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-google-ads")({
  beforeLoad: () => {
    throw redirect({ href: "/api-integrations#google-ads", replace: true });
  },
});
