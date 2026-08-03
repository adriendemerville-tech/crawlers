import { createFileRoute } from "@tanstack/react-router";
import ApiIntegrations from "@/pages/ApiIntegrations";

export const Route = createFileRoute("/api-integrations")({
  component: ApiIntegrations,
});
