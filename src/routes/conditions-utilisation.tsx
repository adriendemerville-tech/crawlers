import { createFileRoute } from "@tanstack/react-router";
import ConditionsUtilisation from "@/pages/ConditionsUtilisation";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/conditions-utilisation")({
  head: () => pageHead({
    title: "Conditions d'utilisation | Crawlers.fr",
    description: "Conditions générales d'utilisation de Crawlers.fr",
    path: "/conditions-utilisation",
    noIndex: true,
  }),
  component: ConditionsUtilisation,
});
