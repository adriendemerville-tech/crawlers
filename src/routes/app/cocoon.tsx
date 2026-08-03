import { createFileRoute } from "@tanstack/react-router";
import Cocoon from "@/pages/Cocoon";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/cocoon")({
  head: () => pageHead({
    title: "Cocon sémantique 3D : architecture SEO & maillage interne",
    description: "Créer un cocon sémantique : visualisez en 3D votre architecture SEO. TF-IDF, clusters thématiques et maillage interne automatique.",
    path: "/app/cocoon",
    noIndex: true,
  }),
  component: Cocoon,
});
