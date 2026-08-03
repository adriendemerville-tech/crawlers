import { createFileRoute } from "@tanstack/react-router";
import AuditSemantique from "@/pages/AuditSemantique";

export const Route = createFileRoute("/audit-semantique")({
  component: AuditSemantique,
});
