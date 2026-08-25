import { createFileRoute } from "@tanstack/react-router";
import Maintenance from "@/pages/Maintenance";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/maintenance")({
  head: () =>
    pageHead({
      title: "Maintenance en cours",
      description:
        "Cette page de Crawlers.fr est momentanément indisponible pour maintenance. Le service sera rétabli très prochainement.",
      path: "/maintenance",
      noIndex: true,
    }),
  component: Maintenance,
});
