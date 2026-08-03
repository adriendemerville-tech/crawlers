import { createFileRoute } from "@tanstack/react-router";
import MatriceHistorique from "@/pages/MatriceHistorique";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/matrice/historique")({
  head: () => pageHead({
    title: "Historique des audits matriciels — Crawlers.fr",
    description: "Consultez et comparez vos audits matriciels passés. Suivi de progression, deltas inter-audits, reprise d'audits interrompus.",
    path: "/matrice/historique",
    noIndex: true,
  }),
  component: MatriceHistorique,
});
