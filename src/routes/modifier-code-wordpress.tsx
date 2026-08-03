import { createFileRoute } from "@tanstack/react-router";
import ModifierCodeWordPress from "@/pages/ModifierCodeWordPress";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/modifier-code-wordpress")({
  head: () => pageHead({
    title: "Comment modifier le code de son site WordPress facilement ? | Crawlers.fr",
    description: "Guide en 4 étapes pour injecter automatiquement les balises SEO et GEO sur WordPress via le plugin Crawlers.fr.",
    path: "/modifier-code-wordpress",
    ogType: "article",
    noIndex: true,
  }),
  component: ModifierCodeWordPress,
});
