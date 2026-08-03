import { createFileRoute } from "@tanstack/react-router";
import Cocoon from "@/pages/Cocoon";

export const Route = createFileRoute("/app/cocoon")({
  component: Cocoon,
});
