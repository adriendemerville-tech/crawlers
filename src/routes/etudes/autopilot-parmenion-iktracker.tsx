import { createFileRoute } from "@tanstack/react-router";
import AutopilotIktracker from "@/pages/etudes/AutopilotIktracker";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/etudes/autopilot-parmenion-iktracker")({
  head: () => pageHead({
    title: "Automatisation SEO : 927 publications, étude de cas",
    description: "Étude de cas : 927 articles publiés automatiquement sur iktracker.fr, 9 requêtes sur 20 en progression et 44,6 % des inscrits venus de ChatGPT.",
    path: "/etudes/autopilot-parmenion-iktracker",
    ogType: "article",
    image: "https://crawlers.fr/og-etude-autopilot-iktracker.jpg",
  }),
  component: AutopilotIktracker,
});
