/**
 * Drop-in remplacement de `fetch('https://ai.gateway.lovable.dev/v1/chat/completions', init)`.
 * PRIMARY: OpenRouter (si OPENROUTER_API_KEY est défini)
 * FALLBACK: Lovable AI Gateway (sur 402/429/5xx/timeout ou si OpenRouter absent)
 *
 * Conforme à la règle projet (knowledge: llm-provider-priority-fr).
 *
 * Usage:
 *   import { aiGatewayFetch } from '../_shared/aiGatewayFetch.ts';
 *   const resp = await aiGatewayFetch(init); // init = même chose que pour fetch
 *   // resp est un Response standard.
 */

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-flash': 'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'google/gemini-2.5-flash-lite-preview',
  'google/gemini-2.5-pro': 'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview': 'google/gemini-2.5-flash',
  'google/gemini-3.1-pro-preview': 'google/gemini-2.5-pro',
  'openai/gpt-5': 'openai/gpt-4o',
  'openai/gpt-5-mini': 'openai/gpt-4o-mini',
  'openai/gpt-5-nano': 'openai/gpt-4o-mini',
};

function mapModel(m?: string): string {
  if (!m) return 'google/gemini-2.5-flash';
  return MODEL_MAP[m] || m;
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 429 || status >= 500;
}

/**
 * Drop-in: prend les mêmes RequestInit qu'un appel fetch direct au Lovable gateway
 * et route automatiquement OpenRouter -> Lovable.
 */
export async function aiGatewayFetch(init: RequestInit): Promise<Response> {
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');

  // Parse le body pour pouvoir remapper le model côté OpenRouter
  let bodyObj: Record<string, unknown> | null = null;
  if (typeof init.body === 'string') {
    try { bodyObj = JSON.parse(init.body); } catch { /* keep null */ }
  }

  // --- PRIMARY: OpenRouter ---
  if (openRouterKey && bodyObj) {
    const orBody = { ...bodyObj, model: mapModel(bodyObj.model as string | undefined) };
    try {
      const resp = await fetch(OPENROUTER_URL, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> || {}),
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.fr',
          'X-Title': 'Crawlers.fr',
        },
        body: JSON.stringify(orBody),
      });
      if (resp.ok) return resp;
      if (!shouldFallback(resp.status)) return resp; // erreur "métier" => on remonte
      console.warn(`[aiGatewayFetch] OpenRouter ${resp.status}, fallback Lovable`);
    } catch (e) {
      console.warn(`[aiGatewayFetch] OpenRouter failed: ${(e as Error).message}, fallback Lovable`);
    }
  }

  // --- FALLBACK: Lovable AI Gateway ---
  if (!lovableKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetch(LOVABLE_URL, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> || {}),
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
  });
}
