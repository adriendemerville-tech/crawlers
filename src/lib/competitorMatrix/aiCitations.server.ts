// Étape 5 — citations IA : Gemini et ChatGPT, 3 itérations par mot-clé.
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

async function askOnce(model: string, question: string): Promise<string> {
  return aiChat({
    model,
    timeoutMs: 30000,
    prompt: `${question}

Réponds en citant explicitement les entreprises ou marques que tu recommandes, avec leur nom de domaine quand tu le connais.`,
  });
}

/** Mesure un seul mot-clé (un appel serveur = un mot-clé, pour rester dans les temps). */
export async function measureKeyword(keyword: string, domains: string[]): Promise<AiReadingJson> {
  const hits = new Map<string, number>();
  let observations = 0;

  for (const { model } of AI_MODELS) {
    const answers = await Promise.all(
      Array.from({ length: AI_ITERATIONS }, () => askOnce(model, keyword)),
    );
    for (const answer of answers) {
      if (!answer) continue;
      observations++;
      for (const d of domains) {
        if (citedIn(answer, d)) hits.set(d, (hits.get(d) || 0) + 1);
      }
    }
  }

  const rates: Record<string, number> = {};
  if (observations > 0) {
    for (const d of domains) rates[d] = (hits.get(d) || 0) / observations;
  }
  return { keyword, rates };
}
