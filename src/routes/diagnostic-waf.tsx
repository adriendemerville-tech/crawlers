import { createFileRoute } from "@tanstack/react-router";
import DiagnosticWaf from "@/pages/DiagnosticWaf";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/diagnostic-waf")({
  head: () => pageHead({
    title: "Diagnostic WAF — Pourquoi mon site est-il bloqué ? | Crawlers.fr",
    description: "Outil de diagnostic gratuit pour comprendre pourquoi un scan échoue : codes HTTP, redirections, robots.txt, headers et User-Agent.",
    path: "/diagnostic-waf",
    noIndex: true,
  }),
  component: DiagnosticWaf,
});
