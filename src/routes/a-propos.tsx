import { createFileRoute } from "@tanstack/react-router";
import APropos from "@/pages/APropos";

export const Route = createFileRoute("/a-propos")({
  component: APropos,
});
