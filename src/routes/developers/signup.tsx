import { createFileRoute } from "@tanstack/react-router";
import DevAuth from "@/pages/developers/DevAuth";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/signup")({
  head: () => pageHead({
    title: "Créer un compte développeur — Crawlers Developers",
    description: "Créez un compte développeur Crawlers et obtenez une clé API pour l'API REST asynchrone /v1/jobs.",
    path: "/developers/signup",
    noIndex: true,
  }),
  component: () => <DevAuth mode="signup" />,
});
