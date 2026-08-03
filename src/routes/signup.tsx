import { createFileRoute } from "@tanstack/react-router";
import SignupPage from "@/pages/Signup";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/signup")({
  head: () => pageHead({
    title: "Créer un compte | Crawlers.fr",
    description: "Créez votre compte Crawlers.fr et lancez votre premier audit SEO & GEO gratuit.",
    path: "/signup",
    noIndex: true,
  }),
  component: SignupPage,
});
