// Étape 5 — citations IA : Gemini, ChatGPT et Claude, 3 itérations par mot-clé.
// On retient un TAUX de citation sur les passages réussis, jamais un tirage
// unique : c'est ce qui distingue une citation stable d'un hasard.
// Coût borné : seuls les mots-clés à plus forte valeur sont mesurés, les autres
// restent « non mesuré ».

import { aiChat, AI_MODELS } from './ai.server';
import { cleanDomain } from './dfs.server';
import { AI_ITERATIONS, type AiReadingJson } from './types';

function brandTokens(domain: string): string[] {
  const clean = cleanDomain(domain);
  const base = clean.split('.')[0].replace(/[-_]/g, ' ').trim();
  const tokens = [clean, base];
  if (base.includes(' ')) tokens.push(base.replace(/\s/g, ''));
  return [...new Set(tokens.filter((t) => t.length >= 4))];
}

export function citedIn(text: string, domain: string): boolean {
  const haystack = text.toLowerCase();
  return brandTokens(domain).some((t) => haystack.includes(t.toLowerCase()));
}

/** TTL du cache de réponses LLM : la SERP générative bouge lentement. */
const AI_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

async function cacheKey(model: string, keyword: string, iteration: number): Promise<string> {
  const bytes = new TextEncoder().encode(`${model}|${keyword.toLowerCase().trim()}|${iteration}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Une réponse LLM par (moteur, mot-clé, itération), mutualisée entre tous les
 * jobs pendant 7 jours : sans ce cache, une matrice consommait jusqu'à 90 appels
 * facturés, y compris pour des mots-clés déjà mesurés la veille.
 */
async function askOnce(model: string, question: string, iteration: number): Promise<string> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const key = await cacheKey(model, question, iteration);
  const since = new Date(Date.now() - AI_CACHE_TTL_MS).toISOString();

  const { data: cached } = await supabaseAdmin
    .from('matrix_ai_answer_cache')
    .select('answer, created_at')
    .eq('cache_key', key)
    .gte('created_at', since)
    .maybeSingle();
  if (cached?.answer) return cached.answer;

  const answer = await aiChat({
    model,
    timeoutMs: 30000,
    prompt: `${question}

Réponds en citant explicitement les entreprises ou marques que tu recommandes, avec leur nom de domaine quand tu le connais.`,
  });

  // Un échec (chaîne vide) n'est pas mis en cache : il serait figé 7 jours.
  if (answer) {
    await supabaseAdmin
      .from('matrix_ai_answer_cache')
      .upsert({ cache_key: key, model, keyword: question.slice(0, 300), answer, created_at: new Date().toISOString() } as never);
  }
  return answer;
}

/**
 * Mesure un mot-clé pour UN SEUL moteur (3 itérations) et fusionne dans le relevé
 * existant. Un appel serveur = un moteur, sinon la requête dépasse la limite de temps.
 */
export async function measureKeywordForModel(
  keyword: string,
  domains: string[],
  model: string,
  previous?: AiReadingJson,
): Promise<AiReadingJson> {
  const hits: Record<string, number> = { ...(previous?.hits ?? {}) };
  let observations = previous?.observations ?? 0;

  const answers = await Promise.all(
    Array.from({ length: AI_ITERATIONS }, (_, i) => askOnce(model, keyword, i)),
  );
  for (const answer of answers) {

    if (!answer) continue;
    observations++;
    for (const d of domains) {
      if (citedIn(answer, d)) hits[d] = (hits[d] || 0) + 1;
    }
  }

  const rates: Record<string, number> = {};
  if (observations > 0) {
    for (const d of domains) rates[d] = (hits[d] || 0) / observations;
  }
  return {
    keyword,
    rates,
    hits,
    observations,
    modelsDone: [...new Set([...(previous?.modelsDone ?? []), model])],
  };
}
