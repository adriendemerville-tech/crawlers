import { createFileRoute } from "@tanstack/react-router";
import CGVU from "@/pages/CGVU";

export const Route = createFileRoute("/cgvu")({
  component: CGVU,
});
