import { createFileRoute } from "@tanstack/react-router";
import Methodologie from "@/pages/Methodologie";

export const Route = createFileRoute("/methodologie")({
  component: Methodologie,
});
