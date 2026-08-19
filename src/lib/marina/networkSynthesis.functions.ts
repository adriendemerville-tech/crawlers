import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { NetworkSynthesisFacts } from './networkSynthesis';
import {
  buildSnapshotRow,
  buildWorkbenchRows,
  normalizeDomain,
} from './networkSynthesisMapping';

/**
 * Persiste la synthèse réseau d'un audit multipages et pousse son plan dans le
 * Workbench.
 *
 * Écrit côté serveur, jamais depuis le navigateur : `architect_workbench`
 * n'accorde aux comptes authentifiés qu'une lecture de leurs propres lignes,
 * l'alimentation restant réservée au backend. `user_id` est imposé par le jeton
 * vérifié, jamais lu dans la charge cliente.
 */
export const persistNetworkSynthesisFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { facts: NetworkSynthesisFacts }) => {
    const facts = data?.facts;
    if (!facts || typeof facts !== 'object') throw new Error('invalid_facts');
    const domain = normalizeDomain(facts.domain);
    if (!domain || !domain.includes('.') || domain.length > 253) throw new Error('invalid_domain');
    if (!Array.isArray(facts.recommendations)) throw new Error('invalid_recommendations');
    if (facts.recommendations.length > 20) throw new Error('too_many_recommendations');
    return { facts, domain };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const userId = context.userId;
    const { facts, domain } = data;

    let snapshotId: string | null = null;
    const { data: snap, error: snapError } = await supabaseAdmin
      .from('marina_network_syntheses')
      .insert(buildSnapshotRow(facts, userId, domain) as never)
      .select('id')
      .single();
    if (snapError) {
      return { snapshotId: null, workbenchItems: 0, error: snapError.message };
    }
    snapshotId = (snap as { id: string } | null)?.id ?? null;

    const rows = buildWorkbenchRows(facts, userId, domain, snapshotId);
    if (!rows.length) return { snapshotId, workbenchItems: 0 };

    const { error: wbError } = await supabaseAdmin
      .from('architect_workbench')
      .upsert(rows as never, { onConflict: 'source_type,source_record_id' });
    if (wbError) {
      return { snapshotId, workbenchItems: 0, error: wbError.message };
    }
    return { snapshotId, workbenchItems: rows.length };
  });
