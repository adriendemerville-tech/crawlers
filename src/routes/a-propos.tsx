import { createFileRoute } from "@tanstack/react-router";
import APropos from "@/pages/APropos";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/a-propos")({
  head: () => pageHead({
    title: "À propos de Crawlers.fr — Audit SEO & GEO par IA",
    description: "Découvrez l'histoire de Crawlers.fr, plateforme SaaS d'audit SEO & GEO créée par Adrien de Volontat. Mission, technologie, valeurs et vision 2026.",
    path: "/a-propos",
  }),
  component: APropos,
});
