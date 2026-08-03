import { createFileRoute } from "@tanstack/react-router";
import Lexique from "@/pages/Lexique";

export const Route = createFileRoute("/lexique")({
  component: Lexique,
});
