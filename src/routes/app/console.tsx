import { createFileRoute } from "@tanstack/react-router";
import Profile from "@/pages/Profile";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/console")({
  head: () => pageHead({
    title: "Console - Crawlers AI",
    description: "Gérez votre profil Crawlers.fr : crédits, abonnement, clé API et paramètres de compte.",
    path: "/app/console",
    noIndex: true,
  }),
  component: Profile,
});
