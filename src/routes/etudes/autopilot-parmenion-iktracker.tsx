import { createFileRoute } from "@tanstack/react-router";
import AutopilotIktracker from "@/pages/etudes/AutopilotIktracker";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/etudes/autopilot-parmenion-iktracker")({
  head: () => pageHead({
    title: "Automatisation SEO : étude de cas, 927 publications automatiques",
    description: "Étude de cas d'automatisation du référencement : un logiciel de référencement automatique a publié 927 articles sur iktracker.fr. 9 requêtes sur 20 en progression, 372 comptes créés, 44,6 % des inscrits venus de ChatGPT.",
    path: "/etudes/autopilot-parmenion-iktracker",
    ogType: "article",
    image: "https://crawlers.fr/og-etude-autopilot-iktracker.jpg",
  }),
  component: AutopilotIktracker,
});
