import { createFileRoute } from "@tanstack/react-router";
import DataFlowDiagram from "@/pages/DataFlowDiagram";

export const Route = createFileRoute("/data-flow-diagram")({
  component: DataFlowDiagram,
});
