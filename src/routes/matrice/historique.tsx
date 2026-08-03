import { createFileRoute } from "@tanstack/react-router";
import MatriceHistorique from "@/pages/MatriceHistorique";

export const Route = createFileRoute("/matrice/historique")({
  component: MatriceHistorique,
});
