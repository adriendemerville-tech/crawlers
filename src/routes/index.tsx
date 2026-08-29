import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { pageHead } from "@/lib/seo/pageHead";
import { homeJsonLd } from "@/lib/seo/homeSchemas";
import heroScreenshot from "@/assets/screenshots/console-pilotage.webp.asset.json";

const homeHead = pageHead({
  title: "Crawlers.fr — outil de crawl SEO & GEO : audit, positions, IA",
  description: "Crawlers.fr, l'outil de crawl SEO & GEO : audit technique complet, positions SERP, backlinks et citations IA. Démarrez votre audit gratuit, sans engagement.",
  path: "/",
  jsonLd: homeJsonLd,
});

export const Route = createFileRoute("/")({
  head: () => ({
    ...homeHead,
    links: [
      ...homeHead.links,
      // LCP mobile : la première capture du carrousel est l'élément le plus
      // lourd au-dessus de la ligne de flottaison → préchargée en priorité
      // haute pour que le navigateur ne l'attende pas la fin du parsing.
      {
        rel: "preload",
        as: "image",
        href: heroScreenshot.url,
        type: "image/webp",
        fetchpriority: "high",
      },
    ],
  }),
  component: Index,
});
