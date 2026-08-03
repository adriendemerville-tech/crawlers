import { createFileRoute } from "@tanstack/react-router";
import KeywordPillarPage from "@/pages/KeywordPillarPage";

export const Route = createFileRoute("/crawler-ia")({
  component: KeywordPillarPage,
});
