import { createFileRoute } from '@tanstack/react-router';

/**
 * Cron de contrôle de publication et de maintien (L4.3).
 *
 * Appelé par le planificateur avec l'en-tête `x-cron-secret`. Traite un lot
 * borné de commandes échues : un contrôle par tour, verdict déterministe,
 * escalade de rendu obligatoire avant tout constat négatif.
 */
export const Route = createFileRoute('/api/public/marketplace-verify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['CRON_SECRET'];
        const provided = request.headers.get('x-cron-secret');
        if (!secret || provided !== secret) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { listDueOrders, runVerification } = await import('@/lib/marketplace/verification.server');
        const { loadConstants } = await import('@/lib/marketplace/constants.server');

        const constants = await loadConstants();
        const ids = await listDueOrders(25);
        const results: unknown[] = [];

        for (const id of ids) {
          try {
            results.push(await runVerification(id, constants));
          } catch (err) {
            results.push({ order_id: id, error: err instanceof Error ? err.message : 'échec du contrôle' });
          }
        }

        return new Response(JSON.stringify({ checked: results.length, results }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      },
    },
  },
});
