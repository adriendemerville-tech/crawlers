import { createFileRoute } from "@tanstack/react-router";
import RGPD from "@/pages/RGPD";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/rgpd")({
  head: () => pageHead({
    title: "RGPD - Protection des données | Crawlers.fr",
    description: "Conformité RGPD et protection des données personnelles sur Crawlers.fr",
    path: "/rgpd",
    noIndex: true,
  }),
  component: RGPD,
});
