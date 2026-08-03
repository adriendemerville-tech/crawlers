import { createFileRoute } from "@tanstack/react-router";
import CopilotPage from "@/pages/CopilotPage";

export const Route = createFileRoute("/app/copilot")({
  component: CopilotPage,
});
