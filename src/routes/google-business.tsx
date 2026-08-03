import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessPage from "@/pages/GoogleBusinessPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/google-business")({
  head: () => pageHead({
    title: "Google Business Profile : SEO local & GEO IA — Crawlers",
    description: "Optimisez votre Google Business Profile pour le SEO local et la visibilité IA (GEO). Score complétude, benchmark concurrent, recos IA.",
    path: "/google-business",
  }),
  component: GoogleBusinessPage,
});
