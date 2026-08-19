import { createFileRoute } from "@tanstack/react-router";
import { serveMarinaReport } from "@/lib/marina/serveReport.server";

/**
 * Lecteur HTML des rapports Marina servi depuis notre domaine (lien historique,
 * conservé pour l'API : `report_view_url`).
 *
 * Le Storage Supabase renvoie les fichiers HTML en `Content-Type: text/plain`
 * (+ nosniff), ce qui affiche le code source. Ce proxy renvoie le même contenu
 * avec le bon type MIME. Le lien court équivalent est `/r/<code>`.
 */
export const Route = createFileRoute("/api/public/marina-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[a-f0-9-]{6,36}$/i.test(id)) {
          return new Response("Identifiant de rapport invalide", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        return serveMarinaReport(id);
      },
    },
  },
});
