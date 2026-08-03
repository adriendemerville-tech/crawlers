import { createFileRoute } from "@tanstack/react-router";
import EEATPage from "@/pages/EEATPage";

export const Route = createFileRoute("/eeat")({
  component: EEATPage,
});
