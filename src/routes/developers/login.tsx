import { createFileRoute } from "@tanstack/react-router";
import DevAuth from "@/pages/developers/DevAuth";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/login")({
  head: () => pageHead({
    title: "Connexion développeurs — Crawlers Developers",
    description: "Connectez-vous à votre espace développeur Crawlers pour gérer vos clés API et votre wallet.",
    path: "/developers/login",
    noIndex: true,
  }),
  component: () => <DevAuth mode="login" />,
});
