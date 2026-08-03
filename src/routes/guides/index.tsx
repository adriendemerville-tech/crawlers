import { createFileRoute } from "@tanstack/react-router";
import GuidesHub from "@/pages/GuidesHub";

export const Route = createFileRoute("/guides/")({
  component: GuidesHub,
});
