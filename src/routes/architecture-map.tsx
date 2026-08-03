import { createFileRoute } from "@tanstack/react-router";
import ArchitectureMapPage from "@/pages/ArchitectureMapPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/architecture-map")({
  head: () => pageHead({
    title: "Architecture Map — Admin Crawlers.fr",
    description: "Cartographie interne de l'architecture technique de Crawlers.fr.",
    path: "/architecture-map",
    noIndex: true,
  }),
  component: ArchitectureMapPage,
});
