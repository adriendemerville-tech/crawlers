import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessPage from "@/pages/GoogleBusinessPage";

export const Route = createFileRoute("/google-business")({
  component: GoogleBusinessPage,
});
