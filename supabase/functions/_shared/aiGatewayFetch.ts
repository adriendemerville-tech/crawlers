/**
 * Multi-provider AI gateway wrapper avec cascade primary → fallback1 → fallback2.
 *
 * ROUTING par préfixe de modèle:
 *   - google/*, openai/*           → Lovable AI Gateway
 *   - anthropic/*                  → OpenRouter (Lovable AI ne supporte pas Claude)
 *   - mistralai/*, qwen/*,
 *     meta-llama/*, moonshotai/*,
 *     perplexity/*                 → OpenRouter
 *
 * Le routage Lovable-first reste possible si OPENROUTER_API_KEY absent
 * (les modèles non-Google/OpenAI sont alors ignorés).
 *
 * Plan: budget cible ~$615/mois, primaires 2026 uniquement (Gemini 3.x, GPT-5.4/5.5)
 * avec exception Claude 4.5 sur chat agents + writer Parménion.
 *
 * Cache Anthropic: passer `cache: 'anthropic'` injecte cache_control sur le system prompt.
 *
 * API:
 *   // Drop-in compat (1 modèle, body parsé):
 *   await aiGatewayFetch({ method: 'POST', body: JSON.stringify({ model, messages }) });
 *
 *   // Multi-fallback (recommandé):
 *   await aiGatewayCall({
 *     primary: 'google/gemini-3-flash-preview',
 *     fallback1: 'claude-haiku-4.5',
 *     fallback2: 'gpt-5-mini',
 *     cache: 'anthropic',
 *     body: { messages, temperature: 0.7 },
 *     timeoutMs: 8000,
 *   });
 */

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_TIMEOUT_MS = 8000;

// Modèles allowlist - sortis en 2026 + exception Claude 4.5
const PRIMARY_ALLOWED_2026 = new Set<string>([
  'google/gemini-3-flash-preview',
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.5-flash',
  'google/gemini-3.1-pro-preview',
  'openai/gpt-5.2',
  'openai/gpt-5.4',
  'openai/gpt-5.4-mini',
  'openai/gpt-5.4-nano',
  'openai/gpt-5.4-pro',
  'openai/gpt-5.5',
  'openai/gpt-5.5-pro',
]);

const PRIMARY_ALLOWED_CLAUDE_EXCEPTION = new Set<string>([
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.5',
]);

// Tous fallbacks autorisés (≤2025)
const FALLBACK_ALLOWED = new Set<string>([
  ...PRIMARY_ALLOWED_2026,
  ...PRIMARY_ALLOWED_CLAUDE_EXCEPTION,
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'mistralai/mistral-large-2411',
  'mistralai/mistral-small-3.2',
  'meta-llama/llama-3.3-70b-instruct',
  'qwen/qwen-2.5-72b-instruct',
  'moonshotai/kimi-k2',
  'perplexity/sonar',
]);

function providerFor(model: string): 'lovable' | 'openrouter' {
  if (model.startsWith('google/') || model.startsWith('openai/')) return 'lovable';
  return 'openrouter';
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 408 || status === 429 || status >= 500;
}

interface AICallOptions {
  primary: string;
  fallback1?: string;
  fallback2?: string;
  cache?: 'anthropic' | 'none';
  body: Record<string, unknown>;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Injecte cache_control: ephemeral sur le premier message system (Anthropic prompt caching).
 * No-op pour les autres providers.
 */
function applyAnthropicCache(model: string, body: Record<string, unknown>): Record<string, unknown> {
  if (!model.startsWith('anthropic/')) return body;
  const messages = body.messages as Array<{ role: string; content: unknown }> | undefined;
  if (!Array.isArray(messages) || messages.length === 0) return body;

  const newMessages = messages.map((m, i) => {
    if (i !== 0 || m.role !== 'system') return m;
    if (typeof m.content === 'string') {
      return {
        role: 'system',
        content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }],
      };
    }
    if (Array.isArray(m.content)) {
      const blocks = m.content.map((b, bi) =>
        bi === 0 && typeof b === 'object' && b !== null
          ? { ...(b as Record<string, unknown>), cache_control: { type: 'ephemeral' } }
          : b,
      );
      return { role: 'system', content: blocks };
    }
    return m;
  });
  return { ...body, messages: newMessages };
}

async function callOnce(
  model: string,
  body: Record<string, unknown>,
  cache: 'anthropic' | 'none',
  timeoutMs: number,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  const provider = providerFor(model);
  const url = provider === 'lovable' ? LOVABLE_URL : OPENROUTER_URL;

  const key = provider === 'lovable'
    ? Deno.env.get('LOVABLE_API_KEY')
    : Deno.env.get('OPENROUTER_API_KEY');

  if (!key) {
    return new Response(
      JSON.stringify({ error: `${provider.toUpperCase()}_API_KEY not configured for model ${model}` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const finalBody = cache === 'anthropic' ? applyAnthropicCache(model, { ...body, model }) : { ...body, model };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...extraHeaders,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://crawlers.fr';
    headers['X-Title'] = 'Crawlers.fr';
  }

  return await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(finalBody),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * API recommandée: cascade primary → fallback1 → fallback2 avec allowlist.
 */
export async function aiGatewayCall(opts: AICallOptions): Promise<Response> {
  const { primary, fallback1, fallback2, cache = 'none', body, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = opts;

  // Validation allowlist primary
  if (!PRIMARY_ALLOWED_2026.has(primary) && !PRIMARY_ALLOWED_CLAUDE_EXCEPTION.has(primary)) {
    console.warn(`[aiGatewayCall] Primary "${primary}" not in allowlist - proceeding anyway`);
  }

  const chain = [primary, fallback1, fallback2].filter((m): m is string => !!m);

  let lastResp: Response | null = null;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isLast = i === chain.length - 1;
    try {
      const resp = await callOnce(model, body, cache, timeoutMs, headers);
      if (resp.ok) {
        if (i > 0) console.info(`[aiGatewayCall] Fallback success: ${model} (level ${i})`);
        return resp;
      }
      if (!shouldFallback(resp.status) || isLast) return resp;
      console.warn(`[aiGatewayCall] ${model} ${resp.status} → fallback`);
      lastResp = resp;
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`[aiGatewayCall] ${model} threw: ${msg}${isLast ? '' : ' → fallback'}`);
      if (isLast) throw e;
    }
  }

  return lastResp ?? new Response(
    JSON.stringify({ error: 'All models failed' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * RÉTRO-COMPAT: API drop-in fetch existante.
 * Parse le body, route selon le model, pas de fallback configurable.
 */
export async function aiGatewayFetch(init: RequestInit): Promise<Response> {
  let bodyObj: Record<string, unknown> = {};
  if (typeof init.body === 'string') {
    try { bodyObj = JSON.parse(init.body); } catch { bodyObj = {}; }
  }
  const model = (bodyObj.model as string) || 'google/gemini-3-flash-preview';
  delete bodyObj.model;

  return await aiGatewayCall({
    primary: model,
    body: bodyObj,
    headers: (init.headers as Record<string, string>) || {},
  });
}

export { PRIMARY_ALLOWED_2026, PRIMARY_ALLOWED_CLAUDE_EXCEPTION, FALLBACK_ALLOWED };
