import { createFileRoute } from "@tanstack/react-router";
import AnalyseLogs from "@/pages/AnalyseLogs";

export const Route = createFileRoute("/analyse-logs")({
  component: AnalyseLogs,
});
