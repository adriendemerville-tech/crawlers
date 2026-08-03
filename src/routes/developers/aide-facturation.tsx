import { createFileRoute } from "@tanstack/react-router";
import DevBillingHelp from "@/pages/developers/DevBillingHelp";

export const Route = createFileRoute("/developers/aide-facturation")({
  component: DevBillingHelp,
});
