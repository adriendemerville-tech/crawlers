import { createFileRoute } from "@tanstack/react-router";
import SharedReportRedirect from "@/pages/SharedReportRedirect";

export const Route = createFileRoute("/temporarylink/$shareId")({
  component: SharedReportRedirect,
});
