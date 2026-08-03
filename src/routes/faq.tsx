import { createFileRoute } from "@tanstack/react-router";
import Faq from "@/pages/Faq";

export const Route = createFileRoute("/faq")({
  component: Faq,
});
