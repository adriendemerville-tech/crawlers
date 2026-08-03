import { createFileRoute } from "@tanstack/react-router";
import RapportViewer from "@/pages/RapportViewer";

export const Route = createFileRoute("/app/rapport/audit")({
  component: RapportViewer,
});
