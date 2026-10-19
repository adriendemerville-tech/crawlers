import { createFileRoute } from "@tanstack/react-router";
import OAuthGoogleCallback from "@/pages/OAuthGoogleCallback";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/oauth/google/callback")({
  head: () => pageHead({
    title: "Connexion Google | Crawlers.fr",
    description: "Finalisation de la connexion de votre compte Google à Crawlers.",
    path: "/oauth/google/callback",
    noIndex: true,
  }),
  component: OAuthGoogleCallback,
});
