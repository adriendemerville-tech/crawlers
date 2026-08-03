import { createFileRoute } from "@tanstack/react-router";
import ReportViewer from "@/pages/ReportViewer";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/rapport/$reportId")({
  head: ({ params }) => pageHead({
    title: "Rapport d'audit — Crawlers.fr",
    description: "Rapport d'audit SEO & GEO détaillé généré par Crawlers.fr.",
    path: `/app/rapport/${params.reportId}`,
    noIndex: true,
  }),
  component: ReportViewer,
});
