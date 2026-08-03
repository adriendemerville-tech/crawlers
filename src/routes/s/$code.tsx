import { createFileRoute } from "@tanstack/react-router";
import ShortLinkRedirect from "@/pages/ShortLinkRedirect";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/s/$code")({
  head: ({ params }) => pageHead({
    title: "Lien court — Crawlers.fr",
    description: "Redirection via un lien court Crawlers.fr.",
    path: `/s/${params.code}`,
    noIndex: true,
  }),
  component: ShortLinkRedirect,
});
