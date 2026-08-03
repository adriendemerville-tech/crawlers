import { createFileRoute } from "@tanstack/react-router";
import DevSdks from "@/pages/developers/DevSdks";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/developers/sdks")({
  head: () => pageHead({
    title: "SDKs TypeScript — Crawlers Developers",
    description: "SDKs officiels TypeScript pour les APIs Crawlers et Parménion.",
    path: "/developers/sdks",
  }),
  component: DevSdks,
});
