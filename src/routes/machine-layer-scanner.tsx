import { createFileRoute } from "@tanstack/react-router";
import MachineLayerLanding from "@/pages/MachineLayerLanding";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/machine-layer-scanner")({
  head: () => pageHead({
    title: "Couche machine : parler aux robots avant les humains — Crawlers.fr",
    description: "L'inversion est en cours : les pages doivent désormais parler aux robots et aux IA d'abord. Découvrez la couche machine et scannez gratuitement la vôtre.",
    path: "/machine-layer-scanner",
    noIndex: true,
  }),
  component: MachineLayerLanding,
});
