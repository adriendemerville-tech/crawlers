import { createFileRoute } from "@tanstack/react-router";
import SharedReportRedirect from "@/pages/SharedReportRedirect";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/temporaryreport/$shareId")({
  head: ({ params }) => pageHead({
    title: "Rapport temporaire — Crawlers.fr",
    description: "Accès temporaire à un rapport d'audit Crawlers.fr.",
    path: `/temporaryreport/${params.shareId}`,
    noIndex: true,
  }),
  component: SharedReportRedirect,
});
