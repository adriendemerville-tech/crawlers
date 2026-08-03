import { createFileRoute } from "@tanstack/react-router";
import VisibiliteLLM from "@/pages/VisibiliteLLM";

export const Route = createFileRoute("/visibilite-llm")({
  component: VisibiliteLLM,
});
