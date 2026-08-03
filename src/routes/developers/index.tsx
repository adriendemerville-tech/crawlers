import { createFileRoute } from "@tanstack/react-router";
import DevLanding from "@/pages/developers/DevLanding";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/")({
  head: () => pageHead({
    title: "API SEO & GEO pour développeurs — REST async, pay-as-you-go",
    description: "3 APIs REST async (Crawlers, Marina, Parménion) pour automatiser SEO, GEO et visibilité IA. 100 jobs gratuits/mois, auth par clé, sans engagement.",
    path: "/developers",
  }),
  component: DevLanding,
});
