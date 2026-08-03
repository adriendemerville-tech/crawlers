import { createFileRoute } from "@tanstack/react-router";
import ArchitecteGeneratif from "@/pages/ArchitecteGeneratif";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/architecte-generatif")({
  head: () => pageHead({
    title: "Architecte Génératif — correctifs SEO/GEO multi-pages",
    description: "Architecte Génératif : générez des correctifs SEO/GEO différents par page — JSON-LD, Open Graph, balises, maillage. Intégration GTM, WordPress ou SDK.",
    path: "/architecte-generatif",
  }),
  component: ArchitecteGeneratif,
});
