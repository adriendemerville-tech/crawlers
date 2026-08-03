import { createFileRoute } from "@tanstack/react-router";
import SharedReportRedirect from "@/pages/SharedReportRedirect";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/temporarylink/$shareId")({
  head: ({ params }) => pageHead({
    title: "Lien temporaire — Crawlers.fr",
    description: "Accès temporaire à un rapport Crawlers.fr.",
    path: `/temporarylink/${params.shareId}`,
    noIndex: true,
  }),
  component: SharedReportRedirect,
});
