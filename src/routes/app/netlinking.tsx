import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/netlinking")({
  head: () =>
    pageHead({
      title: "Netlinking | Crawlers.fr",
      description: "Module netlinking de l'application Crawlers.fr.",
      path: "/app/netlinking",
      noIndex: true,
    }),
  beforeLoad: () => {
    throw redirect({ href: "/app/console?tab=netlinking", replace: true });
  },
});
