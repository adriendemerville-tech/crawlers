import { createFileRoute } from "@tanstack/react-router";
import DevDashboard from "@/pages/developers/DevDashboard";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/dashboard")({
  head: () => pageHead({
    title: "Dashboard — Crawlers Developers",
    description: "Suivez vos jobs API, votre consommation et votre wallet développeur Crawlers.",
    path: "/developers/dashboard",
    noIndex: true,
  }),
  component: DevDashboard,
});
