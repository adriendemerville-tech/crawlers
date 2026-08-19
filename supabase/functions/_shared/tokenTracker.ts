/**
 * Tracks AI token usage.
 *
 * Double écriture volontaire :
 *  - `analytics_events` (event_type `ai_token_usage`) : historique consommé par
 *    les dashboards admin existants (Finances, Marina, Social, Bundles).
 *  - `ai_gateway_usage` : table de coût réelle, avec `estimated_cost_usd`,
 *    interrogeable et indexée. C'est la seule source fiable pour mesurer un
 *    budget par audit (constat de l'audit 2026-08-08 : le coût était
 *    non mesurable car `analytics_events` timeout à l'agrégation).
 */
import { getServiceClient } from './supabaseClient.ts';
import { claimUsageWrite } from './aiUsageLog.ts';

/** Prix estimés par 1M de tokens (USD). */
const MODEL_COST: Record<string, { input: number; output: number }> = {
  'google/gemini-3-flash-preview': { input: 0.15, output: 0.60 },
  'google/gemini-3.1-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
  'google/gemini-3.1-flash-image': { input: 0.30, output: 1.20 },
  'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'openai/gpt-5': { input: 5.00, output: 15.00 },
  'openai/gpt-5-mini': { input: 0.40, output: 1.60 },
  'openai/gpt-5.4': { input: 2.50, output: 10.00 },
  'openai/gpt-5.4-mini': { input: 0.15, output: 0.60 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
};

export function estimateTokenCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = MODEL_COST[model] || { input: 0.50, output: 2.00 };
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

export async function trackTokenUsage(
  functionName: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
  targetUrl?: string,
) {
  if (!usage) return;

  const pt = usage.prompt_tokens || 0;
  const ct = usage.completion_tokens || 0;
  const total = usage.total_tokens || pt + ct;
  const costUsd = estimateTokenCostUsd(model, pt, ct);

  try {
    const supabase = getServiceClient();

    // Table de coût (source de vérité pour la mesure de budget) — fire & forget.
    // `claimUsageWrite` évite la double écriture quand l'appel est déjà passé par
    // le wrapper gateway (`aiGatewayFetch` / `aiRouter`), qui logge de son côté.
    if (claimUsageWrite(model, pt, ct)) {
      supabase.from('ai_gateway_usage').insert({
        gateway: model.startsWith('anthropic/') ? 'openrouter' : model.startsWith('llama') ? 'groq' : 'lovable',
        model,
        edge_function: functionName,
        prompt_tokens: pt,
        completion_tokens: ct,
        total_tokens: total,
        estimated_cost_usd: costUsd,
        is_fallback: false,
      }).then(() => {}, () => {});
    }

    await supabase.from('analytics_events').insert({
      event_type: 'ai_token_usage',
      url: targetUrl || null,
      event_data: {
        function_name: functionName,
        model,
        prompt_tokens: pt,
        completion_tokens: ct,
        total_tokens: total,
        estimated_cost_usd: costUsd,
      },
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}

/**
 * Tracks a paid API call (DataForSEO, Google APIs, etc.)
 */
export async function trackPaidApiCall(
  functionName: string,
  apiService: string,
  endpoint: string,
  targetUrl?: string,
) {
  try {
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'paid_api_call',
      url: targetUrl || null,
      event_data: {
        function_name: functionName,
        api_service: apiService,
        endpoint,
      },
    });
  } catch (e) {
    console.error('[tokenTracker] Failed:', e);
  }
}

/**
 * Tracks an edge function error for admin dashboard visibility.
 * Fire-and-forget — never throws.
 */
export async function trackEdgeFunctionError(
  functionName: string,
  errorMessage: string,
  context?: {
    url?: string;
    user_id?: string;
    domain?: string;
    status_code?: number;
    details?: string;
  },
) {
  try {
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'edge_function_error',
      user_id: context?.user_id || null,
      url: context?.url || null,
      event_data: {
        function_name: functionName,
        error_message: errorMessage,
        domain: context?.domain || null,
        status_code: context?.status_code || 500,
        details: context?.details || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[trackEdgeFunctionError] Failed:', e);
  }
}
