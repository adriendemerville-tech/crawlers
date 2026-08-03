import { createFileRoute } from "@tanstack/react-router";
import ProAgency from "@/pages/ProAgency";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/pro-agency")({
  head: () => pageHead({
    title: "Pro Agency — 29€/mois garanti à vie | Crawlers.fr",
    description: "Plan Pro Agency Crawlers.fr — 29€/mois garanti à vie pour les 100 premiers abonnés. Audits illimités, 30 sites, crawl 5000 pages, agents IA, cocon sémantique.",
    path: "/pro-agency",
    ogType: "product",
  }),
  component: ProAgency,
});
