import { createFileRoute } from "@tanstack/react-router";
import ArchitecteGeneratif from "@/pages/ArchitecteGeneratif";

export const Route = createFileRoute("/architecte-generatif")({
  component: ArchitecteGeneratif,
});
