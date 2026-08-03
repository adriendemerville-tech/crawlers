import { createFileRoute } from "@tanstack/react-router";
import ComparatifClaudeVsCrawlers from "@/pages/ComparatifClaudeVsCrawlers";

export const Route = createFileRoute("/comparatif-claude-vs-crawlers")({
  component: ComparatifClaudeVsCrawlers,
});
