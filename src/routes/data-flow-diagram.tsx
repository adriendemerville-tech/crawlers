import { createFileRoute } from "@tanstack/react-router";
import DataFlowDiagram from "@/pages/DataFlowDiagram";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/data-flow-diagram")({
  head: () => pageHead({
    title: "Arquitectura de Segregación de Datos — Crawlers.fr",
    description: "Comment Crawlers isole les données Google de l'utilisateur : schéma des flux et séparation stricte entre traitement Search Console et appels aux modèles externes.",
    path: "/data-flow-diagram",
    noIndex: true,
  }),
  component: DataFlowDiagram,
});
