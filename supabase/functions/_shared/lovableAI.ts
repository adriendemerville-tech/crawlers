/**
 * Centralized Lovable AI Gateway wrapper with automatic OpenRouter fallback.
 * When Lovable AI returns 402 (credits exhausted) or 429 (rate limit),
 * requests are automatically retried via OpenRouter if OPENROUTER_API_KEY is set.
 * 
 * Usage:
 *   import { callLovableAI, callLovableAIJson } from '../_shared/lovableAI.ts';
 *   const text = await callLovableAI({ system: '...', user: '...' });
 *   const json = await callLovableAIJson<MyType>({ system: '...', user: '...' });
 */

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.3;

/** Map Lovable AI model IDs to OpenRouter equivalents */
const MODEL_FALLBACK_MAP: Record<string, string> = {
  'google/gemini-2.5-flash': 'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'google/gemini-2.5-flash-lite-preview',
  'google/gemini-2.5-pro': 'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview': 'google/gemini-2.5-flash',
  'google/gemini-3.1-pro-preview': 'google/gemini-2.5-pro',
  'openai/gpt-5': 'openai/gpt-4o',
  'openai/gpt-5-mini': 'openai/gpt-4o-mini',
  'openai/gpt-5-nano': 'openai/gpt-4o-mini',
};

export interface LovableAIOptions {
  /** System prompt */
  system?: string;
  /** User prompt */
  user: string;
  /** Model identifier (default: google/gemini-2.5-flash) */
  model?: string;
  /** Temperature (default: 0.3) */
  temperature?: number;
  /** Max tokens (default: 4000) */
  maxTokens?: number;
  /** Full messages array — overrides system/user if provided */
  messages?: Array<{ role: string; content: string }>;
  /** Abort signal for timeout control */
  signal?: AbortSignal;
  /** Response format (e.g. { type: 'json_object' }) */
  responseFormat?: { type: string };
  /** Tools for function calling */
  tools?: unknown[];
  /** Tool choice */
  toolChoice?: unknown;
  /** Disable OpenRouter fallback for this call */
  noFallback?: boolean;
}

export interface LovableAIResponse {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  toolCalls?: unknown[];
  raw: unknown;
  /** Which gateway served this request */
  gateway: 'lovable' | 'openrouter';
}

export class AIGatewayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'RATE_LIMIT' | 'CREDITS_EXHAUSTED' | 'AUTH_ERROR' | 'GATEWAY_ERROR'
  ) {
    super(message);
    this.name = 'AIGatewayError';
  }
}

function getApiKey(): string {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new AIGatewayError('LOVABLE_API_KEY not configured', 500, 'AUTH_ERROR');
  return key;
}

function getOpenRouterKey(): string | null {
  return Deno.env.get('OPENROUTER_API_KEY') || null;
}

function mapModelToOpenRouter(model: string): string {
  return MODEL_FALLBACK_MAP[model] || 'google/gemini-2.5-flash';
}

/** Log fallback event to analytics_events (fire-and-forget) */
async function logFallbackEvent(model: string, primaryGateway: string, fallbackGateway: string, statusCode: number) {
  try {
    const { getServiceClient } = await import('../_shared/supabaseClient.ts');
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'api_gateway_fallback',
      event_data: {
        model,
        primary_gateway: primaryGateway,
        fallback_gateway: fallbackGateway,
        status_code: statusCode,
      },
    });
  } catch {
    // silent — logging should never break the main flow
  }
}

/**
 * Call a gateway (Lovable or OpenRouter) with given config.
 */
async function callGateway(
  url: string,
  apiKey: string,
  model: string,
  opts: LovableAIOptions,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const messages = opts.messages ?? [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: opts.user },
  ];

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  if (opts.responseFormat) body.response_format = opts.responseFormat;
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
}

/**
 * Call Lovable AI Gateway with automatic OpenRouter fallback.
 */
export async function callLovableAI(opts: LovableAIOptions): Promise<LovableAIResponse> {
  const apiKey = getApiKey();
  const model = opts.model ?? DEFAULT_MODEL;

  // --- Primary: Lovable AI Gateway ---
  const response = await callGateway(GATEWAY_URL, apiKey, model, opts);

  if (response.ok) {
    const data = await response.json();
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || '',
      usage: data.usage,
      toolCalls: choice?.message?.tool_calls,
      raw: data,
      gateway: 'lovable',
    };
  }

  // --- Fallback logic ---
  const shouldFallback = (response.status === 402 || response.status === 429) && !opts.noFallback;
  const openRouterKey = getOpenRouterKey();

  if (!shouldFallback || !openRouterKey) {
    const errorText = await response.text();
    console.error(`[lovableAI] Gateway error ${response.status}:`, errorText.slice(0, 200));
    if (response.status === 429) throw new AIGatewayError('Rate limited by AI gateway', 429, 'RATE_LIMIT');
    if (response.status === 402) throw new AIGatewayError('AI credits exhausted', 402, 'CREDITS_EXHAUSTED');
    throw new AIGatewayError(`AI gateway error: ${response.status}`, response.status, 'GATEWAY_ERROR');
  }

  // --- Secondary: OpenRouter ---
  const fallbackModel = mapModelToOpenRouter(model);
  console.warn(`[lovableAI] ⚡ Fallback ${response.status}: ${model} → OpenRouter/${fallbackModel}`);

  // Fire-and-forget analytics
  logFallbackEvent(model, 'lovable', 'openrouter', response.status);

  const fallbackResp = await callGateway(
    OPENROUTER_URL,
    openRouterKey,
    fallbackModel,
    opts,
    { 'HTTP-Referer': 'https://crawlers.lovable.app', 'X-Title': 'Crawlers.fr' },
  );

  if (!fallbackResp.ok) {
    const errText = await fallbackResp.text();
    console.error(`[lovableAI] OpenRouter fallback also failed ${fallbackResp.status}:`, errText.slice(0, 200));
    throw new AIGatewayError(`Both gateways failed. OpenRouter: ${fallbackResp.status}`, fallbackResp.status, 'GATEWAY_ERROR');
  }

  const data = await fallbackResp.json();
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content || '',
    usage: data.usage,
    toolCalls: choice?.message?.tool_calls,
    raw: data,
    gateway: 'openrouter',
  };
}

/**
 * Call Lovable AI and return the text content only.
 */
export async function callLovableAIText(opts: LovableAIOptions): Promise<string> {
  const resp = await callLovableAI(opts);
  return resp.content;
}

/**
 * Call Lovable AI and parse JSON response.
 */
export async function callLovableAIJson<T = unknown>(opts: LovableAIOptions): Promise<T> {
  const resp = await callLovableAI({
    ...opts,
    responseFormat: opts.responseFormat ?? { type: 'json_object' },
  });

  let text = resp.content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  text = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text) as T;
}

/**
 * Check if API key is available (for early validation).
 */
export function isLovableAIConfigured(): boolean {
  return !!Deno.env.get('LOVABLE_API_KEY');
}
