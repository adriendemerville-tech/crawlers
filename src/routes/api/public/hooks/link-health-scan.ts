import { createFileRoute } from '@tanstack/react-router';

/**
 * Cron de contrôle des liens (internes et sortants).
 *
 * Vérifie un lot de pages du sitemap par exécution, en rotation par ancienneté,
 * et alimente la file admin `link_health_queue`. Déterministe : aucun LLM,
 * aucun crédit consommé.
 */
export const Route = createFileRoute('/api/public/hooks/link-health-scan')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Endpoint public : seul le planificateur (porteur du secret) déclenche du travail.
        const provided = request.headers.get('x-cron-secret') || '';
        const accepted = [process.env['CRON_SECRET'], process.env['CRON_SECRET_V2']].filter(
          (s): s is string => Boolean(s),
        );
        if (!provided || !accepted.includes(provided)) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        try {
          const url = new URL(request.url);
          const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit')) || 12));
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { runLinkScan } = await import('@/lib/linkHealth/audit.server');
          const result = await runLinkScan(supabaseAdmin as never, limit);
          console.log(`[link-health] scan ${JSON.stringify(result)}`);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error('[link-health]', message);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
