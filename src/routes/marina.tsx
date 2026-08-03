import { createFileRoute } from "@tanstack/react-router";
import MarinaPage from "@/pages/Marina";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/marina")({
  head: () => pageHead({
    title: "Marina — rapport SEO & GEO en 3 minutes | Crawlers",
    description: "Générez un rapport SEO & GEO professionnel de 15+ pages en 3 minutes. Audit technique 200 points, visibilité IA, cocoon sémantique. 5 crédits/rapport. API embed disponible.",
    path: "/marina",
  }),
  component: MarinaPage,
});
