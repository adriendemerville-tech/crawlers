import { createFileRoute } from "@tanstack/react-router";
import ShortLinkRedirect from "@/pages/ShortLinkRedirect";

export const Route = createFileRoute("/s/$code")({
  component: ShortLinkRedirect,
});
