import { createFileRoute } from "@tanstack/react-router";
import DevAuth from "@/pages/developers/DevAuth";

export const Route = createFileRoute("/developers/signup")({
  component: () => <DevAuth mode="signup" />,
});
