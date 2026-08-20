import { createFileRoute } from "@tanstack/react-router";
import DevSdks from "@/pages/developers/DevSdks";
import { pageHead } from "@/lib/seo/pageHead";
import { buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";

export const Route = createFileRoute("/developers/sdks")({
  head: () => pageHead({
    title: "SDKs TypeScript — Crawlers Developers",
    description: "SDKs officiels TypeScript pour les APIs Crawlers et Parménion.",
    path: "/developers/sdks",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "SDKs TypeScript Crawlers",
        description:
          "SDKs officiels TypeScript pour consommer les APIs Crawlers et Parménion : création de jobs, polling, typage des rapports.",
        programmingLanguage: "TypeScript",
        codeRepository: "https://crawlers.fr/developers/sdks",
        url: "https://crawlers.fr/developers/sdks",
        author: { "@type": "Organization", name: "Crawlers.fr", url: "https://crawlers.fr" },
      },
      buildBreadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Développeurs", path: "/developers" },
        { name: "SDKs", path: "/developers/sdks" },
      ]),
    ],
  }),
  component: DevSdks,
});
