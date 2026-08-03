import { createFileRoute } from "@tanstack/react-router";
import MatricePrompt from "@/pages/MatricePrompt";

export const Route = createFileRoute("/matrice/")({
  component: MatricePrompt,
});
