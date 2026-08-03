import { createFileRoute } from "@tanstack/react-router";
import PageSpeedLanding from "@/pages/PageSpeedLanding";

export const Route = createFileRoute("/pagespeed")({
  component: PageSpeedLanding,
});
