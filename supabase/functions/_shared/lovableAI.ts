/**
 * Centralized Lovable AI Gateway wrapper.
 * Replaces 19+ duplicated fetch calls across edge functions.
 * 
 * Usage:
 *   import { callLovableAI, callLovableAIJson } from '../_shared/lovableAI.ts';
 *   const text = await callLovableAI({ system: '...', user: '...' });
 *   const json = await callLovableAIJson<MyType>({ system: '...', user: '...' });
 */

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.3;

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
}

export interface LovableAIResponse {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  toolCalls?: unknown[];
  raw: unknown;
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

/**
 * Call Lovable AI Gateway and return structured response.
 */
export async function callLovableAI(opts: LovableAIOptions): Promise<LovableAIResponse> {
  const apiKey = getApiKey();
  const model = opts.model ?? DEFAULT_MODEL;

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

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[lovableAI] Gateway error ${response.status}:`, errorText.slice(0, 200));

    if (response.status === 429) {
      throw new AIGatewayError('Rate limited by AI gateway', 429, 'RATE_LIMIT');
    }
    if (response.status === 402) {
      throw new AIGatewayError('AI credits exhausted', 402, 'CREDITS_EXHAUSTED');
    }
    throw new AIGatewayError(`AI gateway error: ${response.status}`, response.status, 'GATEWAY_ERROR');
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '',
    usage: data.usage,
    toolCalls: choice?.message?.tool_calls,
    raw: data,
  };
}

/**
 * Call Lovable AI and return the text content only.
 * Simplest usage for most functions.
 */
export async function callLovableAIText(opts: LovableAIOptions): Promise<string> {
  const resp = await callLovableAI(opts);
  return resp.content;
}

/**
 * Call Lovable AI and parse JSON response.
 * Handles markdown code fences and trailing commas.
 */
export async function callLovableAIJson<T = unknown>(opts: LovableAIOptions): Promise<T> {
  const resp = await callLovableAI({
    ...opts,
    responseFormat: opts.responseFormat ?? { type: 'json_object' },
  });

  let text = resp.content.trim();

  // Strip markdown code fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Remove trailing commas
  text = text.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(text) as T;
}

/**
 * Check if API key is available (for early validation).
 */
export function isLovableAIConfigured(): boolean {
  return !!Deno.env.get('LOVABLE_API_KEY');
}
