import { createFileRoute } from "@tanstack/react-router";
import ReportViewer from "@/pages/ReportViewer";

export const Route = createFileRoute("/app/rapport/$reportId")({
  component: ReportViewer,
});
