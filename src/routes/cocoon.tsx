import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cocoon")({
  beforeLoad: () => {
    throw redirect({ href: "/features/cocoon", statusCode: 301, replace: true });
  },
});
