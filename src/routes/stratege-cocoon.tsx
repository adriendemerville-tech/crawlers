import { createFileRoute } from "@tanstack/react-router";
import StrategeCocoon from "@/pages/StrategeCocoon";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/stratege-cocoon")({
  head: () => pageHead({
    title: "Stratège Cocoon — Consultant IA SEO Senior | Crawlers.fr",
    description: "Stratège Cocoon est un consultant IA senior qui analyse votre cocon sémantique, prescrit des actions concrètes et mesure l'impact réel sur votre SEO. Réservé aux abonnés Pro Agency.",
    path: "/stratege-cocoon",
    noIndex: true,
  }),
  component: StrategeCocoon,
});
