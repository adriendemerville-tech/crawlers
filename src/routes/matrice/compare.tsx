import { createFileRoute } from "@tanstack/react-router";
import MatriceCompare from "@/pages/MatriceCompare";

export const Route = createFileRoute("/matrice/compare")({
  component: MatriceCompare,
});
