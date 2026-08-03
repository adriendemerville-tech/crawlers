import { createFileRoute } from "@tanstack/react-router";
import DevSdks from "@/pages/developers/DevSdks";

export const Route = createFileRoute("/developers/sdks")({
  component: DevSdks,
});
