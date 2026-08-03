import { createFileRoute } from "@tanstack/react-router";
import SiteCrawl from "@/pages/SiteCrawl";

export const Route = createFileRoute("/app/site-crawl")({
  component: SiteCrawl,
});
