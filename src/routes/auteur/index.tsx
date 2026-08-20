import { createFileRoute } from "@tanstack/react-router";
import AuthorsIndex from "@/pages/AuthorsIndex";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/auteur/")({
  head: () => pageHead({
    title: "Auteurs Crawlers.fr — Experts SEO & GEO",
    description: "Découvrez les auteurs et experts derrière les articles, guides et audits Crawlers.fr.",
    path: "/auteur",
    // Index d'auteurs à une seule fiche : la page ne fait que dupliquer le profil.
    // On garde le suivi des liens mais on n'envoie pas l'URL à l'index.
    noIndex: true,
  }),
  component: AuthorsIndex,
});
