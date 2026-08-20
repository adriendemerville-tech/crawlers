import { createFileRoute } from "@tanstack/react-router";
import FeaturesCocoon from "@/pages/FeaturesCocoon";
import { pageHead } from "@/lib/seo/pageHead";
import { cocoonJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/features/cocoon")({
  head: () => pageHead({
    title: "Cocon sémantique 3D : maillage interne et cannibalisation",
    description: "Créer un cocon sémantique en 3D : maillage interne, détection cannibalisation, auto-maillage IA, clustering et ROI prédictif GEO.",
    path: "/features/cocoon",
    ogType: "article",
    jsonLd: cocoonJsonLd,
  }),
  component: FeaturesCocoon,
});
