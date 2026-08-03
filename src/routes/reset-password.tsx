import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/pages/ResetPassword";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/reset-password")({
  head: () => pageHead({
    title: "Réinitialiser le mot de passe | Crawlers.fr",
    description: "Réinitialisez votre mot de passe Crawlers.fr pour retrouver l'accès à vos audits SEO et GEO.",
    path: "/reset-password",
    noIndex: true,
  }),
  component: ResetPassword,
});
