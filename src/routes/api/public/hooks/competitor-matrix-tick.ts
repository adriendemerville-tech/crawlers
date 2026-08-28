import { createFileRoute } from '@tanstack/react-router';

/**
 * Cron d'avancement des matrices de concurrence.
 *
 * Le moteur avance une étape par appel ; ce tick enchaîne les étapes en
 * arrière-plan pour que l'analyse se termine même sans onglet ouvert.
 * Borné par un budget de temps et protégé par le bail `lock_until`.
 */
export const Route = createFileRoute('/api/public/hooks/competitor-matrix-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          const { advanceRunningMatrices } = await import('@/lib/competitorMatrix/engine.server');
          const results = await advanceRunningMatrices(2);
          return new Response(JSON.stringify({ success: true, jobs: results.length, results }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
