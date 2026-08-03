import { createFileRoute } from "@tanstack/react-router";
import DevProfile from "@/pages/developers/DevProfile";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/profile")({
  head: () => pageHead({
    title: "Profil — Crawlers Developers",
    description: "Gérez votre profil développeur, vos clés API et vos moyens de paiement Crawlers.",
    path: "/developers/profile",
    noIndex: true,
  }),
  component: DevProfile,
});
