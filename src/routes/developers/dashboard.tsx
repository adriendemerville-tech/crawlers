import { createFileRoute } from "@tanstack/react-router";
import DevDashboard from "@/pages/developers/DevDashboard";

export const Route = createFileRoute("/developers/dashboard")({
  component: DevDashboard,
});
