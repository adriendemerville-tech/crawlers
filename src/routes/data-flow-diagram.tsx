import { createFileRoute } from "@tanstack/react-router";
import DataFlowDiagram from "@/pages/DataFlowDiagram";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/data-flow-diagram")({
  head: () => pageHead({
    title: "Arquitectura de Segregación de Datos — Crawlers.fr",
    description: "En Crawlers.fr, la protección de los datos de usuario de Google está en el centro de nuestra arquitectura. Este diagrama demuestra la separación estricta entre el procesamiento de datos de Google y los pipelines de generación LLM externos.",
    path: "/data-flow-diagram",
    noIndex: true,
  }),
  component: DataFlowDiagram,
});
