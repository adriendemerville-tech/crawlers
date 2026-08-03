import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/pages/Auth";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/auth")({
  head: () => pageHead({
    title: "Connexion | Crawlers.fr",
    description: "Connectez-vous à Crawlers.fr pour accéder à vos audits SEO & GEO, suivre vos sites et optimiser votre visibilité IA.",
    path: "/auth",
    noIndex: true,
  }),
  component: Auth,
});
