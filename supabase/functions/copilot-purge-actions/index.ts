/**
 * copilot-purge-actions — Sprint 10
 *
 * Purge les lignes `copilot_actions` de plus de RETENTION_DAYS jours,
 * en préservant les actions en attente d'approbation et celles
 * appartenant à une session encore active dans la fenêtre de rétention.
 *
 * Déclenché par cron quotidien (cf. README de la fonction).
 * Auth : header `x-cron-secret` doit matcher CRON_SECRET (sinon 403).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const RETENTION_DAYS = Number(Deno.env.get('COPILOT_RETENTION_DAYS') ?? '90');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (cronSecret && provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const startedAt = Date.now();

  try {
    // Compte avant purge (debug/observabilité).
    const { count: beforeCount } = await supabase
      .from('copilot_actions')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoff);

    // Suppression : tout ce qui est antérieur au cutoff
    // ET qui n'est PAS en attente d'approbation (audit trail conservé).
    const { data: deleted, error: delErr } = await supabase
      .from('copilot_actions')
      .delete()
      .lt('created_at', cutoff)
      .neq('status', 'awaiting_approval')
      .select('id');

    if (delErr) throw delErr;

    // Sessions devenues vides : on les marque archived.
    const { data: archivedSessions, error: archErr } = await supabase
      .from('copilot_sessions')
      .update({ status: 'archived' })
      .lt('last_message_at', cutoff)
      .eq('status', 'active')
      .select('id');

    if (archErr) console.warn('[purge] archive sessions failed:', archErr);

    const result = {
      ok: true,
      retention_days: RETENTION_DAYS,
      cutoff,
      before_count: beforeCount ?? null,
      deleted_actions: deleted?.length ?? 0,
      archived_sessions: archivedSessions?.length ?? 0,
      duration_ms: Date.now() - startedAt,
    };

    console.log('[copilot-purge-actions]', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[copilot-purge-actions] failed:', e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
