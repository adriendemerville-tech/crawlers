import { createFileRoute } from "@tanstack/react-router";
import IntegrationGTM from "@/pages/IntegrationGTM";

export const Route = createFileRoute("/integration-gtm")({
  component: IntegrationGTM,
});
