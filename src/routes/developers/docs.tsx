import { createFileRoute } from "@tanstack/react-router";
import DevDocs from "@/pages/developers/DevDocs";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/docs")({
  head: () => pageHead({
    title: "Documentation API — Crawlers Developers",
    description: "Documentation de l'API REST Crawlers : authentification, endpoints /v1/jobs et features disponibles.",
    path: "/developers/docs",
  }),
  component: DevDocs,
});
