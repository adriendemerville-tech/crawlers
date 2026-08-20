import { createFileRoute } from '@tanstack/react-router';

/**
 * Cron d'orchestration des lots Marina multipages.
 *
 * Fait progresser les lots actifs même quand aucun navigateur n'est ouvert :
 * réconciliation des URLs avec leurs jobs, lancement des suivantes, clôture.
 * Borné par run (5 lots maximum, un lancement par lot), protégé par le bail
 * `lock_until` du lot : deux exécutions simultanées ne travaillent pas en double.
 */
export const Route = createFileRoute('/api/public/hooks/marina-batch-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Endpoint public : seul le cron (porteur du secret) peut déclencher du travail.
        // Deux noms de secret sont acceptés, le planificateur historique et la
        // rotation v2, sinon un renommage coupe silencieusement la file.
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
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { advanceActiveBatches } = await import('@/lib/marina/batchEngine.server');
          const results = await advanceActiveBatches(supabaseAdmin, 5);
          return new Response(
            JSON.stringify({ success: true, batches: results.length, results }),
            { headers: { 'Content-Type': 'application/json' } },
          );
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
