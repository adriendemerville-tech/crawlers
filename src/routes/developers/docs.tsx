import { createFileRoute } from "@tanstack/react-router";
import DevDocs from "@/pages/developers/DevDocs";

export const Route = createFileRoute("/developers/docs")({
  component: DevDocs,
});
