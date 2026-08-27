import { createFileRoute } from "@tanstack/react-router";
import PageSpeedLanding from "@/pages/PageSpeedLanding";
import { pageHead } from "@/lib/seo/pageHead";
import { pagespeedJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/pagespeed")({
  head: () => pageHead({
    title: "Test vitesse site & Core Web Vitals — PageSpeed gratuit",
    description: "Testez votre vitesse et vos Core Web Vitals (LCP, INP, CLS), puis obtenez la cause de chaque ralentissement : CSS bloquant, JS inutilisé, images non optimisées.",
    path: "/pagespeed",
    ogType: "article",
    jsonLd: pagespeedJsonLd,
  }),
  component: PageSpeedLanding,
});
