import { createFileRoute } from "@tanstack/react-router";
import DevAuth from "@/pages/developers/DevAuth";

export const Route = createFileRoute("/developers/login")({
  component: () => <DevAuth mode="login" />,
});
