import { createFileRoute } from "@tanstack/react-router";
import ExtensionDownload from "@/pages/ExtensionDownload";

export const Route = createFileRoute("/extension")({
  component: ExtensionDownload,
});
