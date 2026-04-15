/**
 * Centralized OpenRouter API wrapper.
 * Used for functions that need specific LLM providers (Perplexity, Claude via OpenRouter, etc.)
 * 
 * Usage:
 *   import { callOpenRouter, callOpenRouterJson } from '../_shared/openRouterAI.ts';
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 500;

export interface OpenRouterOptions {
  model: string;
  system?: string;
  user: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  referer?: string;
  title?: string;
}

export interface OpenRouterResponse {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  raw: unknown;
}

function getApiKey(): string {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  return key;
}

export async function callOpenRouter(opts: OpenRouterOptions): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();

  const messages = opts.messages ?? [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: opts.user },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': opts.referer ?? 'https://crawlers.fr',
      'X-Title': opts.title ?? 'Crawlers.fr',
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[openRouterAI] Error ${response.status}:`, errText.slice(0, 200));
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '',
    usage: data.usage,
    raw: data,
  };
}

export async function callOpenRouterText(opts: OpenRouterOptions): Promise<string> {
  const resp = await callOpenRouter(opts);
  return resp.content;
}

export async function callOpenRouterJson<T = unknown>(opts: OpenRouterOptions): Promise<{ parsed: T; usage?: OpenRouterResponse['usage'] }> {
  const resp = await callOpenRouter(opts);
  let text = resp.content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  text = text.replace(/,(\s*[}\]])/g, '$1');
  return { parsed: JSON.parse(text) as T, usage: resp.usage };
}
