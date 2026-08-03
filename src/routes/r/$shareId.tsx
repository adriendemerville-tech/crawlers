import { createFileRoute } from "@tanstack/react-router";
import SharedReportRedirect from "@/pages/SharedReportRedirect";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/r/$shareId")({
  head: ({ params }) => pageHead({
    title: "Rapport partagé — Crawlers.fr",
    description: "Rapport d'audit SEO & GEO partagé via un lien sécurisé Crawlers.fr.",
    path: `/r/${params.shareId}`,
    noIndex: true,
  }),
  component: SharedReportRedirect,
});
