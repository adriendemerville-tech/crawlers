import { createFileRoute } from "@tanstack/react-router";
import CopilotPage from "@/pages/CopilotPage";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/app/copilot")({
  head: () => pageHead({
    title: "Copilot — Félix & Stratège | Crawlers.fr",
    description: "Copilot conversationnel Crawlers.fr : Félix (support) et le Stratège (SEO/GEO) avec mémoire vectorielle.",
    path: "/app/copilot",
    noIndex: true,
  }),
  component: CopilotPage,
});
