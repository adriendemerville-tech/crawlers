/**
 * Multi-provider AI gateway wrapper avec cascade primary → fallback1 → fallback2.
 *
 * ROUTING (règle llm-provider-priority-fr):
 *   - 100% des appels chat completions → OpenRouter en primaire
 *   - google/* et openai/* : Lovable AI Gateway sert de filet de secours
 *     automatique si OpenRouter renvoie 402/408/429/5xx ou throw.
 *   - anthropic/*, mistralai/*, qwen/*, meta-llama/*, moonshotai/*, perplexity/* :
 *     OpenRouter uniquement (Lovable AI ne sert pas ces modèles).
 *
 * Embeddings (`_shared/embeddings.ts`) et image generation restent sur Lovable AI
 * direct — OpenRouter ne couvre pas ces endpoints de manière équivalente.
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

// Kill switch admin: tags des modèles "premium" que `disable_premium=true` saute.
const PREMIUM_MODELS = new Set<string>([
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-5.4',
  'openai/gpt-5.4-pro',
  'openai/gpt-5.5',
  'openai/gpt-5.5-pro',
  'openai/gpt-5.2',
  'google/gemini-3.1-pro-preview',
]);

// Cache process-local du flag global (TTL 60s), lecture lazy via fetch REST anon.
let killSwitchCache: { active: boolean; expiresAt: number } | null = null;
async function isPremiumDisabled(): Promise<boolean> {
  const now = Date.now();
  if (killSwitchCache && killSwitchCache.expiresAt > now) return killSwitchCache.active;
  let active = false;
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (url && key) {
      const r = await fetch(`${url}/rest/v1/ai_routing_global_flags?key=eq.disable_premium&select=enabled`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        const rows = await r.json();
        active = Array.isArray(rows) && rows[0]?.enabled === true;
      }
    }
  } catch { /* silent: défaut = pas de kill switch */ }
  killSwitchCache = { active, expiresAt: now + 60_000 };
  return active;
}

/**
 * Provider primaire = OpenRouter pour TOUS les modèles chat (règle llm-provider-priority-fr).
 * Lovable AI reste fallback automatique pour google/* et openai/* via `aiGatewayCall`.
 * Embeddings + image gen restent câblés directement sur Lovable AI dans leurs helpers dédiés.
 */
function providerFor(_model: string): 'lovable' | 'openrouter' {
  return 'openrouter';
}

/** Modèles que Lovable AI sert nativement et qui peuvent servir de filet en cas de panne OpenRouter. */
function lovableCanServe(model: string): boolean {
  return model.startsWith('google/') || model.startsWith('openai/');
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
  providerOverride?: 'lovable' | 'openrouter',
): Promise<Response> {
  const provider = providerOverride ?? providerFor(model);
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

  let chain = [primary, fallback1, fallback2].filter((m): m is string => !!m);

  // Kill switch: si admin a coupé le premium, saute les modèles tagués PREMIUM_MODELS,
  // sauf si tous les modèles de la chaîne sont premium (alors on garde le moins cher).
  if (await isPremiumDisabled()) {
    const downgraded = chain.filter((m) => !PREMIUM_MODELS.has(m));
    if (downgraded.length > 0) {
      if (downgraded.length !== chain.length) {
        console.info(`[aiGatewayCall] kill switch: downgraded chain ${chain.join('→')} ⇒ ${downgraded.join('→')}`);
      }
      chain = downgraded;
    }
  }

  let lastResp: Response | null = null;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isLast = i === chain.length - 1;
    try {
      // Tentative primaire: OpenRouter pour tous les modèles.
      const resp = await callOnce(model, body, cache, timeoutMs, headers);
      if (resp.ok) {
        if (i > 0) console.info(`[aiGatewayCall] Fallback success: ${model} (level ${i})`);
        return resp;
      }

      // Filet de sécurité Lovable AI pour google/* et openai/* si OpenRouter échoue.
      if (shouldFallback(resp.status) && lovableCanServe(model)) {
        console.warn(`[aiGatewayCall] OpenRouter ${model} ${resp.status} → retry via Lovable AI`);
        try {
          const lov = await callOnce(model, body, cache, timeoutMs, headers, 'lovable');
          if (lov.ok) {
            console.info(`[aiGatewayCall] Lovable AI rescue success: ${model}`);
            return lov;
          }
          if (!shouldFallback(lov.status) || isLast) return lov;
          lastResp = lov;
        } catch (e) {
          console.warn(`[aiGatewayCall] Lovable rescue ${model} threw: ${(e as Error).message}`);
          if (isLast) throw e;
        }
        continue;
      }

      if (!shouldFallback(resp.status) || isLast) return resp;
      console.warn(`[aiGatewayCall] ${model} ${resp.status} → fallback`);
      lastResp = resp;
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`[aiGatewayCall] OpenRouter ${model} threw: ${msg}`);
      // Filet Lovable aussi sur exception réseau/timeout
      if (lovableCanServe(model)) {
        try {
          const lov = await callOnce(model, body, cache, timeoutMs, headers, 'lovable');
          if (lov.ok) {
            console.info(`[aiGatewayCall] Lovable AI rescue success after throw: ${model}`);
            return lov;
          }
          if (!shouldFallback(lov.status) || isLast) return lov;
          lastResp = lov;
          continue;
        } catch (e2) {
          console.warn(`[aiGatewayCall] Lovable rescue ${model} threw: ${(e2 as Error).message}`);
        }
      }
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

// ═══════════════════════════════════════════════════════════════════
// Streaming — Sprint 1 S1.1 (SSE token-by-token pour copilot-orchestrator)
// ═══════════════════════════════════════════════════════════════════
/**
 * Streaming variant: same primary→fallback logic but returns a raw Response
 * whose body is an OpenAI-compatible SSE stream (data: {...}\n\n frames).
 *
 * Fallback behaviour:
 *   - If primary opens the stream (HTTP 200), we return it as-is.
 *   - If primary fails with a status in shouldFallback(), we try the next model.
 *   - As last resort we run a non-streaming aiGatewayCall and synthesize a
 *     single-chunk SSE stream so the caller's parser stays uniform.
 */
export async function aiGatewayCallStream(opts: AICallOptions): Promise<Response> {
  const { primary, fallback1, fallback2, cache = 'none', body, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = opts;

  let chain = [primary, fallback1, fallback2].filter((m): m is string => !!m);
  if (await isPremiumDisabled()) {
    const downgraded = chain.filter((m) => !PREMIUM_MODELS.has(m));
    if (downgraded.length > 0) chain = downgraded;
  }

  const streamBody = { ...body, stream: true };

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isLast = i === chain.length - 1;
    try {
      const resp = await callOnce(model, streamBody, cache, timeoutMs, headers);
      if (resp.ok) {
        if (i > 0) console.info(`[aiGatewayCallStream] Fallback success: ${model} (level ${i})`);
        return resp;
      }
      if (shouldFallback(resp.status) && lovableCanServe(model)) {
        try {
          const lov = await callOnce(model, streamBody, cache, timeoutMs, headers, 'lovable');
          if (lov.ok) return lov;
        } catch { /* fall through */ }
      }
      if (!shouldFallback(resp.status) || isLast) return resp;
      try { await resp.body?.cancel(); } catch { /* noop */ }
    } catch (e) {
      console.warn(`[aiGatewayCallStream] ${model} threw: ${(e as Error).message}`);
      if (isLast) {
        const nonStream = await aiGatewayCall({ primary, fallback1, fallback2, cache, body, timeoutMs, headers });
        return synthesizeSseFromJson(nonStream);
      }
    }
  }

  const nonStream = await aiGatewayCall({ primary, fallback1, fallback2, cache, body, timeoutMs, headers });
  return synthesizeSseFromJson(nonStream);
}

/** Convertit une Response JSON classique en flux SSE monobloc (parseur OpenAI uniforme). */
async function synthesizeSseFromJson(resp: Response): Promise<Response> {
  if (!resp.ok) return resp;
  const data = await resp.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown }; finish_reason?: string }>;
    usage?: Record<string, unknown>;
  } | null;
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? '';
  const tool_calls = choice?.message?.tool_calls;
  const finish = choice?.finish_reason ?? (tool_calls ? 'tool_calls' : 'stop');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const push = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      if (content) push({ choices: [{ index: 0, delta: { content } }] });
      if (tool_calls) push({ choices: [{ index: 0, delta: { tool_calls } }] });
      push({ choices: [{ index: 0, delta: {}, finish_reason: finish }], usage: data?.usage });
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

export { PRIMARY_ALLOWED_2026, PRIMARY_ALLOWED_CLAUDE_EXCEPTION, FALLBACK_ALLOWED };
