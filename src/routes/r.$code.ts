import { createFileRoute } from "@tanstack/react-router";
import { serveMarinaReport } from "@/lib/marina/serveReport.server";

/**
 * Lien court d'un rapport Marina : https://crawlers.fr/r/<code>
 * `code` = début de l'identifiant du rapport (8 caractères suffisent) ou
 * l'identifiant complet. Remplace l'URL signée Storage, illisible à partager.
 */
export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      GET: ({ params }) => serveMarinaReport(params.code),
    },
  },
});
