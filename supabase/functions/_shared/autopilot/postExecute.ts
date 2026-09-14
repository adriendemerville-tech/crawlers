/**
 * autopilot/postExecute.ts — Post-execute phase: mark workbench items as deployed.
 * Extracted from autopilot-engine monolith.
 */

import { getServiceClient } from '../supabaseClient.ts';

type Supabase = ReturnType<typeof getServiceClient>;

/**
 * Mark workbench items as 'deployed' based on real CMS action successes.
 * Only marks items when actual content/code was deployed (not just executionSuccess=true).
 */
export async function markDeployedItems(
  supabase: Supabase,
  domain: string,
  executionResults: any[],
  /** Décision Périclès à l'origine de l'exécution : sert de clé de mesure. */
  periclesDecisionId?: string | null,
) {
  const linkage = periclesDecisionId
    ? { pericles_decision_id: periclesDecisionId, reward_verdict: 'pending_measure' }
    : {};
  const realContentSuccesses = executionResults.filter(
    (r: any) => r.status === 'success' && r.cms_action && (
      r.cms_action === 'create-post' || r.cms_action === 'update-post' ||
      r.cms_action === 'update-page' || r.cms_action === 'create-page'
    )
  );
  const realCodeSuccesses = executionResults.filter(
    (r: any) => r.status === 'success' && (
      r.function === 'generate-corrective-code' || r.cms_action === 'inject-code' ||
      (r.function === 'cms-push-code' && r.triggered_by)
    )
  );

  const baseUpdate = (extra: Record<string, unknown>) => ({
    ...extra,
    consumed_at: new Date().toISOString(),
    status: 'deployed' as any,
    deployed_at: new Date().toISOString(),
    validate_attempts: 0,
    updated_at: new Date().toISOString(),
  });

  /** Le marquage `deployed` ne doit jamais échouer à cause du rattachement Périclès. */
  const markWithFallback = async (
    extra: Record<string, unknown>,
    applyFilters: (q: any) => any,
  ): Promise<any[]> => {
    const run = (payload: Record<string, unknown>) =>
      applyFilters(supabase.from('architect_workbench').update(payload)).select('id');
    const { data, error } = await run({ ...baseUpdate(extra), ...linkage });
    if (!error) return data || [];
    console.warn('[AutopilotEngine] deployed mark error:', error.message);
    if (Object.keys(linkage).length === 0) return [];
    const retry = await run(baseUpdate(extra));
    if (retry.error) console.warn('[AutopilotEngine] deployed mark retry error:', retry.error.message);
    return retry.data || [];
  };

  try {
    if (realContentSuccesses.length > 0) {
      const markedItems = await markWithFallback({ consumed_by_content: true }, (q) =>
        q.eq('domain', domain)
          .in('status', ['pending', 'in_progress'])
          .in('finding_category', ['missing_page', 'content_gap', 'content_upgrade', 'missing_terms']),
      );

      if (markedItems.length > 0) {
        console.log(`[AutopilotEngine] 🚀 Marked ${markedItems.length} workbench items as 'deployed' (${realContentSuccesses.length} real CMS successes) for ${domain}`);
      }
    } else {
      console.log(`[AutopilotEngine] ⚠️ POST-EXECUTE: No real content CMS successes found — skipping deployed mark for ${domain}`);
    }

    if (realCodeSuccesses.length > 0) {
      const techMarked = await markWithFallback({ consumed_by_code: true }, (q) =>
        q.eq('domain', domain)
          .in('status', ['pending', 'in_progress'])
          .not('finding_category', 'in', '("missing_page","content_gap","content_upgrade","missing_terms")'),
      );

      if (techMarked.length > 0) {
        console.log(`[AutopilotEngine] 🚀 Marked ${techMarked.length} tech workbench items as 'deployed' for ${domain}`);
      }
    }
  } catch (e) {
    console.warn('[AutopilotEngine] POST-EXECUTE deployed exception:', e);
  }
}
