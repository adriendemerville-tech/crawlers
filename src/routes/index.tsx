import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/")({
  head: () => pageHead({
    title: "Crawlers.fr — La plateforme SEO & GEO française",
    description: "Crawlers.fr réunit crawl technique, cocon sémantique 3D, analyse de logs et visibilité IA dans une seule plateforme. Conçue en France par un pro du SEO/GEO.",
    path: "/",
  }),
  component: Index,
});
