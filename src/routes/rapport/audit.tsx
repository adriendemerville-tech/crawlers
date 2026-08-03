import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rapport/audit")({
  beforeLoad: () => {
    throw redirect({ href: "/app/rapport/audit", replace: true });
  },
});
