import { createFileRoute } from "@tanstack/react-router";
import DevProfile from "@/pages/developers/DevProfile";

export const Route = createFileRoute("/developers/profile")({
  component: DevProfile,
});
