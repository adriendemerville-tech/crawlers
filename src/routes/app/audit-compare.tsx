import { createFileRoute } from "@tanstack/react-router";
import AuditCompare from "@/pages/AuditCompare";

export const Route = createFileRoute("/app/audit-compare")({
  component: AuditCompare,
});
