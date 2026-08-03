import { createFileRoute } from "@tanstack/react-router";
import ParmenionApiDoc from "@/pages/docs/ParmenionApiDoc";

export const Route = createFileRoute("/docs/api/parmenion")({
  component: ParmenionApiDoc,
});
