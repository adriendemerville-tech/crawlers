import { createFileRoute } from "@tanstack/react-router";
import FeaturesCocoon from "@/pages/FeaturesCocoon";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/features/cocoon")({
  head: () => pageHead({
    title: "Cocoon refresh",
    description: "Créer un cocon sémantique en 3D : maillage interne, détection cannibalisation, auto-maillage IA, clustering et ROI prédictif GEO.",
    path: "/features/cocoon",
    noIndex: true,
  }),
  component: FeaturesCocoon,
});
