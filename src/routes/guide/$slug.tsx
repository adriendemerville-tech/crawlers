import { createFileRoute } from "@tanstack/react-router";
import GuideLandingPage from "@/pages/GuideLandingPage";

export const Route = createFileRoute("/guide/$slug")({
  component: GuideLandingPage,
});
