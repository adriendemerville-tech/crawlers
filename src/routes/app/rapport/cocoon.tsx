import { createFileRoute } from "@tanstack/react-router";
import RapportViewer from "@/pages/RapportViewer";

export const Route = createFileRoute("/app/rapport/cocoon")({
  component: RapportViewer,
});
