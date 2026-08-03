import { createFileRoute } from "@tanstack/react-router";
import DevBillingHelp from "@/pages/developers/DevBillingHelp";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/aide-facturation")({
  head: () => pageHead({
    title: "Aide facturation & wallet — Crawlers Developers",
    description: "FAQ et guide pas-à-pas pour la wallet pay-as-you-go Crawlers.",
    path: "/developers/aide-facturation",
  }),
  component: DevBillingHelp,
});
