import { createFileRoute } from "@tanstack/react-router";
import ExtensionDownload from "@/pages/ExtensionDownload";
import { pageHead } from "@/lib/seo/pageHead";
import { extensionJsonLd } from "@/lib/seo/pageSchemas";

export const Route = createFileRoute("/extension")({
  head: () => pageHead({
    title: "Extension Chrome Crawlers — Audit SEO en 1 clic",
    description: "Installez l'extension Crawlers et auditez n'importe quelle page web en un clic. Findings injectés directement dans votre Workbench.",
    path: "/extension",
    jsonLd: extensionJsonLd,
  }),
  component: ExtensionDownload,
});
