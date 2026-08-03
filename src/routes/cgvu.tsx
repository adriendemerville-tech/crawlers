import { createFileRoute } from "@tanstack/react-router";
import CGVU from "@/pages/CGVU";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/cgvu")({
  head: () => pageHead({
    title: "Conditions Générales de Vente et d'Utilisation | Crawlers.fr",
    description: "CGVU de Crawlers.fr – Conditions générales de vente et d'utilisation de la plateforme d'audit SEO/GEO et de crédits d'analyse IA.",
    path: "/cgvu",
    noIndex: true,
  }),
  component: CGVU,
});
