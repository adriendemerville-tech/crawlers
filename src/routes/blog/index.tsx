import { createFileRoute } from "@tanstack/react-router";
import Blog from "@/pages/Blog";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/blog/")({
  head: () => pageHead({
    title: "Blog Crawlers.fr — Actualités SEO, GEO et IA | Crawlers.fr",
    description: "Blog Crawlers.fr — actualités SEO, GEO et visibilité IA. Guides pratiques, études de cas, veille algorithmique Google et LLMs.",
    path: "/blog",
  }),
  component: Blog,
});
