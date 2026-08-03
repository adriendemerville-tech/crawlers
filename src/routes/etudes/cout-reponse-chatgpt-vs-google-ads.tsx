import { createFileRoute } from "@tanstack/react-router";
import CoutChatGPTvsGoogleAds from "@/pages/etudes/CoutChatGPTvsGoogleAds";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/etudes/cout-reponse-chatgpt-vs-google-ads")({
  head: () => pageHead({
    title: "Coût réponse ChatGPT vs clic Google Ads — Étude FR 2026",
    description: "Étude propriétaire : 1 clic Google Ads coûte jusqu'à 689 fois plus cher qu'une réponse ChatGPT. Comparaison sur 8 secteurs FR.",
    path: "/etudes/cout-reponse-chatgpt-vs-google-ads",
    ogType: "article",
  }),
  component: CoutChatGPTvsGoogleAds,
});
