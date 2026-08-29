import { createFileRoute } from "@tanstack/react-router";
import FeaturesConsole from "@/pages/FeaturesConsole";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/features/console")({
  head: () => pageHead({
    title: "Console SEO & GEO Crawlers — cockpit unifié 16 modules",
    description: "La Console Crawlers réunit SEO, GEO, plans d'action, crawls, content, GMB et reporting dans un cockpit outil SEO unifié pour agences.",
    path: "/features/console",
    
  }),
  component: FeaturesConsole,
});
