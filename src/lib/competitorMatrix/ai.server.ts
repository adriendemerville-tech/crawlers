// Appels LLM de la matrice concurrence, via la passerelle IA Lovable.
// Quatre moteurs de citation : Gemini, ChatGPT, Claude et Perplexity.

export const AI_MODELS = [
  { id: 'gemini', label: 'Gemini', model: 'google/gemini-3.7-flash' },
  { id: 'chatgpt', label: 'ChatGPT', model: 'openai/gpt-5.4-mini' },
  { id: 'claude', label: 'Claude', model: 'anthropic/claude-3-5-sonnet-20241022' },
  { id: 'perplexity', label: 'Perplexity', model: 'perplexity/sonar-pro' },
];

interface ChatOptions {
  model: string;
  prompt: string;
  json?: boolean;
  timeoutMs?: number;
}

/**
 * Retourne le texte de la réponse, ou une chaîne vide en cas d'échec.
 * 402/403 (crédits épuisés, blocage workspace) sont terminaux : on ne réessaie pas.
 */
export async function aiChat({ model, prompt, json, timeoutMs = 30000 }: ChatOptions): Promise<string> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) {
    console.error('[competitor-matrix] LOVABLE_API_KEY missing');
    return '';
  }
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[competitor-matrix] AI gateway ${res.status}`, body.slice(0, 200));
      return '';
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('[competitor-matrix] AI gateway error', e instanceof Error ? e.message : e);
    return '';
  }
}

export function parseJsonLoose(raw: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/^```json\s*|^```\s*|```$/gm, '').trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
