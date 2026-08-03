import { createFileRoute } from "@tanstack/react-router";
import BotActivity from "@/pages/BotActivity";

export const Route = createFileRoute("/app/bot-activity")({
  component: BotActivity,
});
