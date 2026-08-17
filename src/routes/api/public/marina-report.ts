import { createFileRoute } from "@tanstack/react-router";

/**
 * Lecteur HTML des rapports Marina servi depuis notre domaine.
 *
 * Le Storage Supabase et les edge functions renvoient les fichiers HTML avec
 * `Content-Type: text/plain` + `X-Content-Type-Options: nosniff` (protection
 * anti-XSS de la plateforme), ce qui affiche le code source au lieu du rapport.
 * Ce proxy renvoie le même contenu avec le bon type MIME.
 */
export const Route = createFileRoute("/api/public/marina-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[a-f0-9-]{36}$/i.test(id)) {
          return new Response("Identifiant de rapport invalide", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("shared-reports")
          .download(`marina/${id}.html`);

        if (error || !data) {
          return new Response(
            `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rapport introuvable</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0f17;color:#e2e8f0"><div style="text-align:center"><h1>Rapport introuvable</h1><p style="color:#94a3b8">Ce rapport a expiré ou n'existe pas.</p></div></body></html>`,
            { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }

        return new Response(await data.text(), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, max-age=300",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
