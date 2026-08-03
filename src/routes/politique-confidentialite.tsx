import { createFileRoute } from "@tanstack/react-router";
import PolitiqueConfidentialite from "@/pages/PolitiqueConfidentialite";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/politique-confidentialite")({
  head: () => pageHead({
    title: "Politique de confidentialité | Crawlers.fr",
    description: "Politique de confidentialité de Crawlers.fr",
    path: "/politique-confidentialite",
    noIndex: true,
  }),
  component: PolitiqueConfidentialite,
});
