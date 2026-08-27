import { createFileRoute } from "@tanstack/react-router";
import RGPD from "@/pages/RGPD";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/rgpd")({
  head: () => pageHead({
    title: "RGPD - Protection des données | Crawlers.fr",
    description: "Conformité RGPD de Crawlers, édité par Voluntas Novare (SIREN 992 399 667) : données collectées, hébergement UE, durées de conservation et exercice des droits.",
    path: "/rgpd",
    noIndex: true,
  }),
  component: RGPD,
});
