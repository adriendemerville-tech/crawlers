import { createFileRoute } from "@tanstack/react-router";
import SocialContentCreator from "@/pages/SocialContentCreator";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/social-content-creator")({
  head: () => pageHead({
    title: "Social Content Hub — publication SEO/GEO | Crawlers",
    description: "Créez, planifiez et publiez du contenu social optimisé SEO/GEO sur LinkedIn, Facebook et Instagram. Smart Linking, génération IA et analytics intégrés.",
    path: "/social-content-creator",
    noIndex: true,
  }),
  component: SocialContentCreator,
});
