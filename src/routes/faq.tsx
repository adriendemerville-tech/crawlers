import { createFileRoute } from "@tanstack/react-router";
import Faq from "@/pages/Faq";
import { pageHead } from "@/lib/seo/pageHead";
import { faqPageJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/faq")({
  head: () => pageHead({
    title: "FAQ Crawlers.fr — Questions fréquentes SEO & GEO | Crawlers.fr",
    description: "Réponses aux questions fréquentes : ce que mesure l'audit SEO, comment le score GEO est calculé, comment fonctionnent les crédits et ce que couvre Pro Agency.",
    path: "/faq",
    jsonLd: [faqPageJsonLd],
  }),
  component: Faq,
});
