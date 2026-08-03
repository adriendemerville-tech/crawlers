import { createFileRoute } from "@tanstack/react-router";
import PageSpeedLanding from "@/pages/PageSpeedLanding";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/pagespeed")({
  head: () => pageHead({
    title: "Test vitesse site & Core Web Vitals — PageSpeed gratuit",
    description: "Testez gratuitement la vitesse de votre site. Analyse LCP, INP, CLS et Core Web Vitals avec recommandations Google PageSpeed.",
    path: "/pagespeed",
    ogType: "article",
  }),
  component: PageSpeedLanding,
});
