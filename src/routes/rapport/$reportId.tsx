import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rapport/$reportId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/rapport/$reportId",
      params: { reportId: params.reportId },
      replace: true,
    });
  },
});
