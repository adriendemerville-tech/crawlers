/**
 * Daily Cost Guard — Enforces a max daily EUR spend for agent LLM calls.
 * Queries analytics_events for today's token usage and calculates accumulated cost.
 */
import { getServiceClient } from './supabaseClient.ts';
import { calculateLLMCost } from './llmCostCalculator.ts';

const DEFAULT_DAILY_CAP_EUR = 1.0;

interface CostGuardResult {
  allowed: boolean;
  spent_today_eur: number;
  cap_eur: number;
  reason?: string;
}

/**
 * Check if an agent (cto or supervisor) has exceeded its daily EUR cap.
 * Uses cto_agent_logs / supervisor_logs metadata to sum costs.
 */
export async function checkDailyCostCap(
  agent: 'cto' | 'supervisor',
  capEur: number = DEFAULT_DAILY_CAP_EUR,
): Promise<CostGuardResult> {
  try {
    const supabase = getServiceClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const since = todayStart.toISOString();

    let spentToday = 0;

    if (agent === 'cto') {
      const { data } = await supabase
        .from('cto_agent_logs')
        .select('metadata, created_at')
        .gte('created_at', since)
        .limit(200);

      if (data) {
        for (const log of data as any[]) {
          const tokens = log.metadata?.tokens;
          if (tokens) {
            const cost = calculateLLMCost('anthropic/claude-3.5-sonnet', tokens.input || 0, tokens.output || 0);
            spentToday += cost.eur;
          } else if (log.metadata?.llm_cost?.total_eur != null) {
            spentToday += log.metadata.llm_cost.total_eur;
          }
        }
      }
    } else {
      const { data } = await supabase
        .from('supervisor_logs' as any)
        .select('metadata, created_at')
        .gte('created_at', since)
        .limit(200);

      if (data) {
        for (const log of data as any[]) {
          if (log.metadata?.llm_cost?.total_eur != null) {
            spentToday += log.metadata.llm_cost.total_eur;
          } else {
            // Fallback estimate per call
            const cost = calculateLLMCost('anthropic/claude-3.5-sonnet', 2000, 1500);
            spentToday += cost.eur;
          }
        }
      }
    }

    spentToday = Math.round(spentToday * 10000) / 10000;

    if (spentToday >= capEur) {
      console.warn(`[CostGuard] ${agent} BLOCKED — spent ${spentToday}€ today (cap: ${capEur}€)`);
      return {
        allowed: false,
        spent_today_eur: spentToday,
        cap_eur: capEur,
        reason: `Budget journalier atteint (${spentToday.toFixed(2)}€ / ${capEur}€). L'agent ${agent} est suspendu jusqu'à demain.`,
      };
    }

    return { allowed: true, spent_today_eur: spentToday, cap_eur: capEur };
  } catch (e) {
    console.error(`[CostGuard] Error for ${agent} (allowing):`, e);
    return { allowed: true, spent_today_eur: 0, cap_eur: capEur };
  }
}
