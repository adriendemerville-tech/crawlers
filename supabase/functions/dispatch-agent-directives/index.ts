import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';

/**
 * dispatch-agent-directives
 * 
 * Cron every 10 min — polls pending directives from all agent tables
 * and triggers the corresponding agent edge function.
 * 
 * Agent SEO: picks its own target from pending directives (target_slug)
 * Agent CTO: triggered with a lightweight audit to process pending directives
 * Agent UX: triggered with action=analyze on target pages
 * Supervisor: triggered with action=analyze (audits CTO corrections)
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const AGENT_CONFIG = [
  {
    name: 'seo',
    table: 'agent_seo_directives',
    functionName: 'agent-seo',
    buildBody: (directive: any) => ({
      target_slug: directive.target_slug || null,
      base_url: 'https://crawlers.fr',
    }),
  },
  {
    name: 'cto',
    table: 'agent_cto_directives',
    functionName: 'agent-cto',
    // CTO needs an auditResult — trigger a lightweight technical audit
    buildBody: (directive: any) => ({
      auditType: directive.target_function || 'technical',
      auditResult: { triggered_by: 'dispatch-agent-directives', directive_id: directive.id, directive_text: directive.directive_text },
      url: directive.target_url || 'https://crawlers.fr',
      domain: 'crawlers.fr',
    }),
  },
  {
    name: 'ux',
    table: 'agent_ux_directives',
    functionName: 'agent-ux',
    buildBody: (directive: any) => ({
      action: directive.target_component ? 'create_component' : 'analyze',
      target_page: directive.target_url || '/',
      directive: directive.directive_text,
    }),
  },
  {
    name: 'supervisor',
    table: 'agent_supervisor_directives',
    functionName: 'supervisor-actions',
    buildBody: (directive: any) => ({
      action: directive.target_function || 'analyze',
    }),
  },
];

const DELAY_BETWEEN_AGENTS_MS = 2000;

Deno.serve(handleRequest(async (_req) => {
  const supabase = getServiceClient();
  const report: Record<string, { found: number; triggered: number; errors: string[]; recovered: number }> = {};

  // ── STALE RECOVERY: Reset in_progress directives older than 30 minutes back to pending ──
  for (const agent of AGENT_CONFIG) {
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: stale } = await supabase
        .from(agent.table as any)
        .update({ status: 'pending' } as any)
        .eq('status', 'in_progress')
        .lt('updated_at', thirtyMinAgo)
        .select('id');
      if (stale?.length) {
        console.log(`[dispatch] ♻️ Recovered ${stale.length} stale ${agent.name} directive(s)`);
      }
    } catch { /* ignore */ }
  }

  for (const agent of AGENT_CONFIG) {
    const agentReport = { found: 0, triggered: 0, errors: [] as string[], recovered: 0 };
    report[agent.name] = agentReport;

    try {
      // Fetch oldest pending directives (max 3 per agent per cycle)
      const { data: directives, error } = await supabase
        .from(agent.table as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(3);

      if (error) {
        agentReport.errors.push(`Query error: ${error.message}`);
        continue;
      }

      if (!directives?.length) continue;
      agentReport.found = directives.length;

      // Mark directives as in_progress to avoid double-processing
      const ids = (directives as any[]).map((d: any) => d.id);
      await supabase
        .from(agent.table as any)
        .update({ status: 'in_progress' } as any)
        .in('id', ids);

      // Trigger the agent for the first directive (agents pick up all pending internally)
      const firstDirective = (directives as any[])[0];
      const body = agent.buildBody(firstDirective);

      console.log(`[dispatch] 🚀 Triggering ${agent.functionName} for ${agentReport.found} directive(s)`);

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/${agent.functionName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (resp.ok) {
          agentReport.triggered = 1;
          console.log(`[dispatch] ✅ ${agent.functionName} responded ${resp.status}`);
        } else {
          const errText = await resp.text().catch(() => '');
          agentReport.errors.push(`${agent.functionName} returned ${resp.status}: ${errText.slice(0, 200)}`);
          console.error(`[dispatch] ❌ ${agent.functionName}: ${resp.status}`);
          
          // Revert to pending on failure
          await supabase
            .from(agent.table as any)
            .update({ status: 'pending' } as any)
            .in('id', ids);
        }
      } catch (fetchErr) {
        agentReport.errors.push(`Fetch error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
        // Revert to pending
        await supabase
          .from(agent.table as any)
          .update({ status: 'pending' } as any)
          .in('id', ids);
      }

      // Small delay between agents to avoid overload
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_AGENTS_MS));

    } catch (e) {
      agentReport.errors.push(String(e));
      await trackEdgeFunctionError('dispatch-agent-directives', String(e)).catch(() => {});
    }
  }

  const totalFound = Object.values(report).reduce((s, r) => s + r.found, 0);
  const totalTriggered = Object.values(report).reduce((s, r) => s + r.triggered, 0);
  console.log(`[dispatch] Done — ${totalFound} pending, ${totalTriggered} agents triggered`);

  return jsonOk({ success: true, report, total_found: totalFound, total_triggered: totalTriggered });
}));
