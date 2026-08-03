import { createFileRoute } from "@tanstack/react-router";
import MachineLayerScanner from "@/pages/MachineLayerScanner";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/machine-layer")({
  head: () => pageHead({
    title: "Machine Layer Scanner — Crawlers.fr | Audit signaux SEO/GEO",
    description: "Scannez gratuitement la couche machine de votre site : meta, OpenGraph, JSON-LD, robots.txt, llms.txt, headers HTTP. Recommandations rédigées prêtes à coller.",
    path: "/app/machine-layer",
    noIndex: true,
  }),
  component: MachineLayerScanner,
});
