import { createFileRoute } from "@tanstack/react-router";
import SocialHub from "@/pages/SocialHub";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/social")({
  head: () => pageHead({
    title: "Social Content Hub — Crawlers.fr",
    description: "Créez et publiez du contenu social optimisé SEO/GEO sur LinkedIn, Facebook et Instagram.",
    path: "/app/social",
    noIndex: true,
  }),
  component: SocialHub,
});
