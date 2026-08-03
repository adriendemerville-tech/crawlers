import { createFileRoute } from "@tanstack/react-router";
import SocialContentCreator from "@/pages/SocialContentCreator";

export const Route = createFileRoute("/social-content-creator")({
  component: SocialContentCreator,
});
