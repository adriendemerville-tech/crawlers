import { createFileRoute } from "@tanstack/react-router";
import GuidesHub from "@/pages/GuidesHub";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/guides/")({
  head: () => pageHead({
    title: "Guides SEO & GEO par métier | Crawlers",
    description: "Guides pratiques SEO et GEO adaptés à votre métier : artisan, commerçant, PME, startup, agence SEO, consultant. Améliorez votre visibilité sur Google et les IA.",
    path: "/guides",
  }),
  component: GuidesHub,
});
