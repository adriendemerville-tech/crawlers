/**
 * Lightweight AI usage logger for edge functions that call ai.gateway.lovable.dev directly.
 * Fire-and-forget: never blocks or throws.
 */

/** Estimated cost per 1M tokens (USD) */
const MODEL_COST: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'google/gemini-3-flash-preview': { input: 0.15, output: 0.60 },
  'google/gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
  'openai/gpt-5': { input: 5.00, output: 15.00 },
  'openai/gpt-5-mini': { input: 0.40, output: 1.60 },
};

function estimateCost(model: string, pt: number, ct: number): number {
  const p = MODEL_COST[model] || { input: 0.50, output: 2.00 };
  return (pt * p.input + ct * p.output) / 1_000_000;
}

/**
 * Log usage from a non-streaming response (has usage in body).
 */
export function logAIUsageFromResponse(
  supabase: any,
  model: string,
  edgeFunction: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): void {
  try {
    const pt = usage?.prompt_tokens || 0;
    const ct = usage?.completion_tokens || 0;
    supabase.from('ai_gateway_usage').insert({
      gateway: 'lovable',
      model,
      edge_function: edgeFunction,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: usage?.total_tokens || (pt + ct),
      estimated_cost_usd: estimateCost(model, pt, ct),
      is_fallback: false,
    }).then(() => {}).catch(() => {});
  } catch { /* silent */ }
}

/**
 * Log estimated usage for streaming responses (no usage object available).
 * Estimates tokens from prompt character count (~4 chars/token).
 */
export function logAIUsageEstimated(
  supabase: any,
  model: string,
  edgeFunction: string,
  promptChars: number,
  estimatedOutputTokens: number = 400,
): void {
  try {
    const pt = Math.ceil(promptChars / 4);
    const ct = estimatedOutputTokens;
    supabase.from('ai_gateway_usage').insert({
      gateway: 'lovable',
      model,
      edge_function: edgeFunction,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: pt + ct,
      estimated_cost_usd: estimateCost(model, pt, ct),
      is_fallback: false,
    }).then(() => {}).catch(() => {});
  } catch { /* silent */ }
}
