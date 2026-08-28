// Étape 1 — identité de l'entreprise cible, déduite des métadonnées réelles.
// Aucune localité n'est inventée : sans mention explicite, `locality` reste null.

import { aiChat, parseJsonLoose } from './ai.server';
import { buildMarketLexicon } from './relevance.server';
import type { Identity } from './types';

async function fetchPageContext(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || '';
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]).join(' | ');
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].slice(0, 8).map((m) => m[1]).join(' | ');
    return `TITLE: ${strip(title)}\nDESCRIPTION: ${strip(desc)}\nH1: ${strip(h1s)}\nH2: ${strip(h2s)}`.slice(0, 2000);
  } catch {
    return '';
  }
}

// Une localité présente dans le slug d'URL est une preuve acceptable
// (ex. /renovation-marseille) — cf. règle de résolution de zone.
function localityFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const match = path.match(/[-/]([a-zàâäéèêëîïôöùûüç]{4,})(?:$|\/|\.)/);
    return match ? null : null; // pas de déduction lexicale hasardeuse ici
  } catch {
    return null;
  }
}

export async function resolveIdentity(url: string, domain: string): Promise<Identity> {
  const context = await fetchPageContext(url);
  const fallback: Identity = {
    domain,
    name: domain.split('.')[0],
    activity: context.slice(0, 300) || domain,
    locality: localityFromUrl(url),
  };
  if (!context) return { ...fallback, lexicon: await buildMarketLexicon(fallback) };

  const raw = await aiChat({
    model: 'google/gemini-3.1-flash-lite',
    json: true,
    prompt: `Voici les métadonnées d'une page (domaine ${domain}) :
${context}

Déduis l'identité de l'entreprise. Ne devine jamais une ville : "locality" vaut null si aucune localité n'est explicitement présente dans les métadonnées.
JSON strict : {"name":"...","activity":"l'offre en une phrase, sans jargon web","locality":null}`,
  });
  const parsed = parseJsonLoose(raw);
  const identity: Identity = parsed
    ? {
        domain,
        name: String(parsed.name || fallback.name).slice(0, 80),
        activity: String(parsed.activity || fallback.activity).slice(0, 300),
        locality: parsed.locality ? String(parsed.locality).slice(0, 60) : fallback.locality,
      }
    : fallback;

  // Le lexique est calculé ici une seule fois : toutes les étapes suivantes
  // l'utilisent comme filtre de pertinence, sans nouvel appel LLM.
  return { ...identity, lexicon: await buildMarketLexicon(identity) };
}
