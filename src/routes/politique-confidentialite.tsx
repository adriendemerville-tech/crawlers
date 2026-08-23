import { createFileRoute } from "@tanstack/react-router";
import PolitiqueConfidentialite from "@/pages/PolitiqueConfidentialite";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/politique-confidentialite")({
  head: () => pageHead({
    title: "Politique de confidentialité | Crawlers.fr",
    description: "Comment Crawlers collecte, héberge (UE) et conserve les données : traitements, durées, sous-traitants, cookies et exercice des droits RGPD.",
    path: "/politique-confidentialite",
  }),
  component: PolitiqueConfidentialite,
});
