import { createFileRoute } from "@tanstack/react-router";
import IntegrationGTM from "@/pages/IntegrationGTM";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/integration-gtm")({
  head: () => pageHead({
    title: "Brancher votre site — API, WordPress, GTM | Crawlers.fr",
    description: "Connectez votre site à Crawlers via Google Tag Manager, WordPress ou API CMS en 30 s. Injection auto, sandboxing, débranchage instant.",
    path: "/integration-gtm",
    ogType: "article",
    noIndex: true,
  }),
  component: IntegrationGTM,
});
