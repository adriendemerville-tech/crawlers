import { createFileRoute } from "@tanstack/react-router";
import ExpertAudit from "@/pages/ExpertAudit";

export const Route = createFileRoute("/audit-expert")({
  component: ExpertAudit,
});
