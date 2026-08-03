import { createFileRoute } from "@tanstack/react-router";
import OAuthConsent from "@/pages/OAuthConsent";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => pageHead({
    title: "Autoriser l'accès — Crawlers",
    description: "Écran d'autorisation OAuth pour connecter une application à votre compte Crawlers.fr.",
    path: "/.lovable/oauth/consent",
    noIndex: true,
  }),
  component: OAuthConsent,
});
