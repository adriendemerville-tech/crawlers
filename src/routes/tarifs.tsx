import { createFileRoute } from "@tanstack/react-router";
import Tarifs from "@/pages/Tarifs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/tarifs")({
  head: () => pageHead({
    title: "Tarifs Crawlers.fr — SEO + GEO à 29€/mois | Crawlers.fr",
    description: "SEO et GEO à partir de 29 €/mois, tarif garanti à vie pour les 100 premiers abonnés. Audits illimités, 30 sites, correctifs prêts à déployer. Plan gratuit.",
    path: "/tarifs",
  }),
  component: Tarifs,
});
