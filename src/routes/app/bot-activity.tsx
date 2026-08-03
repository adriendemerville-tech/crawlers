import { createFileRoute } from "@tanstack/react-router";
import BotActivity from "@/pages/BotActivity";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/bot-activity")({
  head: () => pageHead({
    title: "Activité des Bots — Crawlers AI",
    description: "Surveillez le passage de GPTBot, ClaudeBot, PerplexityBot et Googlebot sur votre site, avec vérification rDNS/ASN.",
    path: "/app/bot-activity",
    noIndex: true,
  }),
  component: BotActivity,
});
