import { createFileRoute } from "@tanstack/react-router";
import BreathingSpiral from "@/pages/BreathingSpiral";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/breathing-spiral")({
  head: () => pageHead({
    title: "Breathing Spiral — pilotage SEO adaptatif par IA",
    description: "Breathing Spiral : pilotage SEO homéostatique piloté par 9 signaux temps réel. Oscillation entre consolidation et expansion pour une croissance organique durable.",
    path: "/breathing-spiral",
    ogType: "article",
  }),
  component: BreathingSpiral,
});
