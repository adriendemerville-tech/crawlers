/**
 * aiUsageLog.ts — point d'insertion unique dans `ai_gateway_usage`.
 *
 * Deux problèmes que ce module règle (audit 2026-08-19, P0) :
 *  1. `callRoutedAI` (aiRouter.ts) n'écrivait aucune ligne de coût : tout ce qui
 *     passe par le routeur admin (benchmark_questions, verdict_narration,
 *     tonalizer, cocoon-auto-linking, contentIntegrity, linkedin) était invisible.
 *  2. Les appelants de `aiGatewayCall` qui oublient `callerFunction` produisaient
 *     `edge_function = 'unknown'`. On déduit désormais le nom depuis la pile
 *     d'appel (`file:///.../functions/<nom>/index.ts`).
 *
 * Écriture fire-and-forget : ne bloque ni ne casse jamais l'appel LLM.
 */

import { estimateTokenCostUsd } from './tokenTracker.ts';

export interface AiUsageTokens {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Déduit le nom de l'edge function courante depuis la pile d'appel.
 * Supabase n'expose pas le nom en variable d'environnement, mais les chemins
 * de modules contiennent toujours `/functions/<nom>/`.
 */
export function detectEdgeFunctionName(): string | null {
  try {
    const stack = new Error().stack || '';
    // On ignore _shared : ce n'est pas une function déployée.
    const matches = [...stack.matchAll(/\/functions\/([A-Za-z0-9_-]+)\//g)]
      .map((m) => m[1])
      .filter((name) => name !== '_shared');
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

/** Insère une ligne de coût. `feature` sert au suivi par fonctionnalité du routeur. */
export function logAiUsage(opts: {
  gateway: 'lovable' | 'openrouter' | 'groq';
  model: string;
  edgeFunction?: string | null;
  feature?: string | null;
  usage?: AiUsageTokens;
  isFallback?: boolean;
}): void {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;

    const pt = Number(opts.usage?.prompt_tokens) || 0;
    const ct = Number(opts.usage?.completion_tokens) || 0;
    if (pt === 0 && ct === 0) return;

    const edgeFunction = opts.edgeFunction || detectEdgeFunctionName();

    void fetch(`${url}/rest/v1/ai_gateway_usage`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        gateway: opts.gateway,
        model: opts.model,
        edge_function: edgeFunction,
        feature: opts.feature ?? null,
        prompt_tokens: pt,
        completion_tokens: ct,
        total_tokens: Number(opts.usage?.total_tokens) || pt + ct,
        estimated_cost_usd: estimateTokenCostUsd(opts.model, pt, ct),
        cache_creation_tokens: Number(opts.usage?.cache_creation_input_tokens) || 0,
        cache_read_tokens: Number(opts.usage?.cache_read_input_tokens) || 0,
        is_fallback: opts.isFallback ?? false,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch { /* silent */ }
}
