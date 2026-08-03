import { createFileRoute } from "@tanstack/react-router";
import RapportMatrice from "@/pages/RapportMatrice";

export const Route = createFileRoute("/app/rapport/matrice")({
  component: RapportMatrice,
});
