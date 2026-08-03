import { createFileRoute } from "@tanstack/react-router";
import PolitiqueConfidentialite from "@/pages/PolitiqueConfidentialite";

export const Route = createFileRoute("/politique-confidentialite")({
  component: PolitiqueConfidentialite,
});
