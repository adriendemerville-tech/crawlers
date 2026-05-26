/**
 * aiRouter.ts — Router AI par feature avec override admin.
 *
 * Permet de basculer dynamiquement certaines fonctionnalités vers Groq
 * (rapide & économique) tout en gardant la possibilité de revenir au
 * modèle d'origine via la table `ai_routing_overrides` (UI admin).
 *
 * Usage :
 *   import { callRoutedAI } from '../_shared/aiRouter.ts';
 *   const { content } = await callRoutedAI('editorial_tonalizer', {
 *     system: '...', user: '...', jsonMode: true,
 *     fallbackModel: 'google/gemini-2.5-flash',
 *   });
 *
 * Comportement :
 *  - Si feature.enabled = true + provider = 'groq' → appelle Groq avec feature.model.
 *    En cas d'erreur Groq → fallback automatique vers Lovable AI Gateway.
 *  - Sinon → utilise Lovable AI Gateway avec feature.model (ou fallbackModel).
 *
 * Cache TTL 30s : évite un hit DB à chaque appel LLM.
 */

import { getServiceClient } from './supabaseClient.ts';
import { callGroq } from './groqClient.ts';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const CACHE_TTL_MS = 30_000;

interface RoutingRow {
  feature: string;
  enabled: boolean;
  provider: 'groq' | 'lovable';
  model: string;
  original_model: string;
}

const cache = new Map<string, { row: RoutingRow | null; expiresAt: number }>();

export async function getRouting(feature: string): Promise<RoutingRow | null> {
  const now = Date.now();
  const cached = cache.get(feature);
  if (cached && cached.expiresAt > now) return cached.row;

  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('ai_routing_overrides')
      .select('feature, enabled, provider, model, original_model')
      .eq('feature', feature)
      .maybeSingle();
    const row = (data as RoutingRow) ?? null;
    cache.set(feature, { row, expiresAt: now + CACHE_TTL_MS });
    return row;
  } catch (e) {
    console.warn(`[aiRouter] getRouting(${feature}) failed:`, (e as Error).message);
    return null;
  }
}

export interface RoutedAIOptions {
  system?: string;
  user: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: any;
  /** Modèle Lovable par défaut si aucune override n'existe en DB. */
  fallbackModel?: string;
  timeoutMs?: number;
}

export interface RoutedAIResult {
  content: string;
  tool_calls: Array<{ name: string; arguments: any }>;
  model_used: string;
  provider_used: 'groq' | 'lovable';
  raw: any;
}

export async function callRoutedAI(
  feature: string,
  opts: RoutedAIOptions,
): Promise<RoutedAIResult> {
  const routing = await getRouting(feature);
  const useGroq = routing?.enabled === true && routing.provider === 'groq';

  const messages = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    { role: 'user' as const, content: opts.user },
  ];

  if (useGroq) {
    try {
      const r = await callGroq({
        model: routing!.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens,
        tools: opts.tools,
        tool_choice: opts.toolChoice,
        response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
        timeoutMs: opts.timeoutMs ?? 60_000,
      });
      return {
        content: r.content,
        tool_calls: r.tool_calls,
        model_used: routing!.model,
        provider_used: 'groq',
        raw: r.raw,
      };
    } catch (e) {
      console.warn(`[aiRouter] Groq failed for ${feature}, falling back to Lovable:`, (e as Error).message);
      // fallthrough vers Lovable
    }
  }

  const model = routing?.original_model || opts.fallbackModel || 'google/gemini-2.5-flash';
  return await callLovable(model, messages, opts);
}

async function callLovable(
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts: RoutedAIOptions,
): Promise<RoutedAIResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY missing');

  const body: Record<string, unknown> = { model, messages, temperature: opts.temperature ?? 0.3 };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Lovable gateway ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const msg = json?.choices?.[0]?.message ?? {};
  const tool_calls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc: any) => ({
        name: tc?.function?.name,
        arguments: typeof tc?.function?.arguments === 'string' ? safeJson(tc.function.arguments) : tc?.function?.arguments,
      }))
    : [];
  return {
    content: msg.content ?? '',
    tool_calls,
    model_used: model,
    provider_used: 'lovable',
    raw: json,
  };
}

function safeJson(s: string): any { try { return JSON.parse(s); } catch { return {}; } }
