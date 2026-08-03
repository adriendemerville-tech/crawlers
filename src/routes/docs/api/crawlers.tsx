import { createFileRoute } from "@tanstack/react-router";
import CrawlersApiDoc from "@/pages/docs/CrawlersApiDoc";

export const Route = createFileRoute("/docs/api/crawlers")({
  component: CrawlersApiDoc,
});
