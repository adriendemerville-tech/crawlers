import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rapport/cocoon")({
  beforeLoad: () => {
    throw redirect({ href: "/app/rapport/cocoon", replace: true });
  },
});
