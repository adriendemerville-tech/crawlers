import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/")({
  head: () => pageHead({
    title: "Audit SEO & GEO expert gratuit | Crawlers.fr",
    description: "Audit SEO, GEO & IA 168 critères. Score GEO gratuit en 30 sec, analyse de logs, Content Architect IA. Conçu par un pro du SEO/GEO.",
    path: "/",
  }),
  component: Index,
});
