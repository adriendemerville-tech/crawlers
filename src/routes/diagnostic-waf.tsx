import { createFileRoute } from "@tanstack/react-router";
import DiagnosticWaf from "@/pages/DiagnosticWaf";

export const Route = createFileRoute("/diagnostic-waf")({
  component: DiagnosticWaf,
});
