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
) {
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

  try {
    if (realContentSuccesses.length > 0) {
      const { data: markedItems, error } = await supabase
        .from('architect_workbench')
        .update({
          consumed_by_content: true,
          consumed_at: new Date().toISOString(),
          status: 'deployed' as any,
          deployed_at: new Date().toISOString(),
          validate_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('domain', domain)
        .in('status', ['pending', 'in_progress'])
        .in('finding_category', ['missing_page', 'content_gap', 'content_upgrade', 'missing_terms'])
        .select('id');

      if (markedItems && markedItems.length > 0) {
        console.log(`[AutopilotEngine] 🚀 Marked ${markedItems.length} workbench items as 'deployed' (${realContentSuccesses.length} real CMS successes) for ${domain}`);
      }
      if (error) console.warn('[AutopilotEngine] deployed mark error:', error.message);
    } else {
      console.log(`[AutopilotEngine] ⚠️ POST-EXECUTE: No real content CMS successes found — skipping deployed mark for ${domain}`);
    }

    if (realCodeSuccesses.length > 0) {
      const { data: techMarked, error } = await supabase
        .from('architect_workbench')
        .update({
          consumed_by_code: true,
          consumed_at: new Date().toISOString(),
          status: 'deployed' as any,
          deployed_at: new Date().toISOString(),
          validate_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('domain', domain)
        .in('status', ['pending', 'in_progress'])
        .not('finding_category', 'in', '("missing_page","content_gap","content_upgrade","missing_terms")')
        .select('id');

      if (techMarked && techMarked.length > 0) {
        console.log(`[AutopilotEngine] 🚀 Marked ${techMarked.length} tech workbench items as 'deployed' for ${domain}`);
      }
      if (error) console.warn('[AutopilotEngine] tech deployed mark error:', error.message);
    }
  } catch (e) {
    console.warn('[AutopilotEngine] POST-EXECUTE deployed exception:', e);
  }
}
