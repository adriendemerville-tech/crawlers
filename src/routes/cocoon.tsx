import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cocoon")({
  beforeLoad: () => {
    throw redirect({ href: "/app/cocoon", replace: true });
  },
});
