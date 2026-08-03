import { createFileRoute } from "@tanstack/react-router";
import MarinaApiDoc from "@/pages/docs/MarinaApiDoc";

export const Route = createFileRoute("/docs/api/marina")({
  component: MarinaApiDoc,
});
