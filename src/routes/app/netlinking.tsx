import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/netlinking")({
  beforeLoad: () => {
    throw redirect({ href: "/app/console?tab=netlinking", replace: true });
  },
});
