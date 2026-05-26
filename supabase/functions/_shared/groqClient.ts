/**
 * groqClient.ts — Wrapper minimal pour l'API Groq (OpenAI-compatible).
 *
 * Endpoint : https://api.groq.com/openai/v1/chat/completions
 * Auth     : Bearer GROQ_API_KEY (secret edge)
 *
 * Usage :
 *   import { callGroq } from '../_shared/groqClient.ts';
 *   const text = await callGroq({ model: 'llama-3.3-70b-versatile', messages: [...] });
 *
 * Modèles recommandés (rapide / qualité) :
 *   - llama-3.3-70b-versatile     (qualité, 128k ctx)
 *   - llama-3.1-8b-instant        (ultra-rapide, low cost)
 *   - openai/gpt-oss-120b         (raisonnement)
 *   - moonshotai/kimi-k2-instruct (long contexte)
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface GroqCallOptions {
  model?: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: any;
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
  timeoutMs?: number;
}

export interface GroqResult {
  content: string;
  tool_calls: Array<{ name: string; arguments: any }>;
  raw: any;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export async function callGroqRaw(opts: GroqCallOptions): Promise<Response> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY missing');

  const {
    model = DEFAULT_MODEL,
    messages,
    temperature = 0.3,
    max_tokens,
    tools,
    tool_choice,
    response_format,
    stream = false,
    timeoutMs = 60_000,
  } = opts;

  const body: Record<string, unknown> = { model, messages, temperature, stream };
  if (max_tokens) body.max_tokens = max_tokens;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;
  if (response_format) body.response_format = response_format;

  return await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function callGroq(opts: GroqCallOptions): Promise<GroqResult> {
  const resp = await callGroqRaw({ ...opts, stream: false });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Groq ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  const msg = json?.choices?.[0]?.message ?? {};
  const tool_calls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc: any) => ({
        name: tc?.function?.name,
        arguments:
          typeof tc?.function?.arguments === 'string'
            ? safeJson(tc.function.arguments)
            : tc?.function?.arguments,
      }))
    : [];
  return { content: msg.content ?? '', tool_calls, raw: json };
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}
