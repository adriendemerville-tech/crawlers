import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/console")({
  beforeLoad: () => {
    throw redirect({ href: "/app/console", replace: true });
  },
});
