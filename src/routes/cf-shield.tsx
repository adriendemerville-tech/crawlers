import { createFileRoute } from "@tanstack/react-router";
import CfShield from "@/pages/CfShield";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/cf-shield")({
  head: () => pageHead({
    title: "Activer le Bouclier Cloudflare AI Bots — Crawlers",
    description: "Déployez le Worker Cloudflare qui alimente vos KPIs GEO en hits bots IA et trafic référent.",
    path: "/cf-shield",
    noIndex: true,
  }),
  component: CfShield,
});
