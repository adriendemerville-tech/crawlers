import { createFileRoute } from "@tanstack/react-router";
import ConditionsUtilisation from "@/pages/ConditionsUtilisation";

export const Route = createFileRoute("/conditions-utilisation")({
  component: ConditionsUtilisation,
});
