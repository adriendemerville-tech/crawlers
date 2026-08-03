import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/audit-compare")({
  beforeLoad: () => {
    throw redirect({ href: "/app/audit-compare", replace: true });
  },
});
