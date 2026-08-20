import { createFileRoute } from "@tanstack/react-router";
import ComparatifPlateforme from "@/pages/ComparatifPlateforme";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/comparatif-plateforme-seo-ia")({
  head: () => pageHead({
    title: "Plateforme SEO/GEO vs agents IA généralistes (Claude, GPT)",
    description: "Pourquoi une plateforme SEO/GEO dédiée qui croise vos données surpasse Claude, ChatGPT ou Cowork pour le référencement naturel.",
    path: "/comparatif-plateforme-seo-ia",
    ogType: "article",
  }),
  component: ComparatifPlateforme,
});
