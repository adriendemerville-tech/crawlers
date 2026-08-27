import { createFileRoute } from "@tanstack/react-router";
import Aide from "@/pages/Aide";
import { pageHead } from "@/lib/seo/pageHead";
import { aideJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/aide")({
  head: () => pageHead({
    title: "Centre d'aide — guides pas-à-pas des audits et de la console",
    description: "Guides pas-à-pas : connecter Search Console, brancher votre CMS, lire un rapport d'audit, gérer vos crédits et déployer les correctifs sur votre site.",
    path: "/aide",
    jsonLd: [aideJsonLd],
  }),
  component: Aide,
});
