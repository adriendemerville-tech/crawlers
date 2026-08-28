// Filtre de pertinence — la carte d'identité devient un FILTRE, pas une simple
// étiquette de rapport.
//
// Constat de production (iktracker.fr) : sans filtre, `ranked_keywords` et le
// gap concurrent remontaient les mégavolumes administratifs (« ameli »,
// « parcoursup », « impots gouv »), et les leaders lus dans ces SERP devenaient
// service-public.gouv.fr. La matrice mesurait alors un marché qui n'était pas
// celui de l'entreprise. On dérive donc du métier un lexique de marché, et tout
// mot-clé qui n'y appartient pas est écarté avant tout appel payant.

import { aiChat, parseJsonLoose } from './ai.server';
import type { Identity, MarketLexicon } from './types';

export function normalizeKw(kw: string): string {
  return String(kw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Requêtes administratives / grand public : jamais un marché d'entreprise. */
const ADMIN_NOISE =
  /\b(ameli|caf|urssaf|pajemploi|ensap|anef|ants|parcoursup|educonnect|agirc|arrco|impot|impots|service public|meteo|vacances? scolaires?|horaire|resultat|match|recette|film|streaming|code postal|numero de telephone|deces|carte grise|permis de conduire)\b/;

/** Domaines institutionnels / portails : ni leader ni concurrent d'un marché SaaS. */
export function isNoiseDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase();
  if (/\.gouv\.fr$/.test(d) || /\.gouv\.fr\./.test(d)) return true;
  return /^(service-public|legifrance|ameli|urssaf|impots|economie|entreprendre|francenum|infogreffe|journal-officiel|net-entreprises|pajemploi|onisep|data)\./.test(d)
    || /^(wikipedia|wikiwand|journaldunet|lesechos|lefigaro|lemonde|20minutes|ouest-france|capital|bfmtv|francetvinfo|leparisien|futura-sciences|linternaute|commentcamarche)\./.test(d);
}

/**
 * Un seul appel LLM : termes de marché réellement tapés + jetons de pertinence.
 * `requiredTokens` sert de garde déterministe (aucun LLM appelé par mot-clé).
 */
export async function buildMarketLexicon(identity: Identity): Promise<MarketLexicon> {
  const raw = await aiChat({
    model: 'google/gemini-3.7-flash',
    json: true,
    prompt: `Entreprise : ${identity.name}
Activité : ${identity.activity}
Zone : ${identity.locality || 'France'}

1) "marketTerms" : 20 requêtes courtes (2 à 5 mots) réellement tapées dans Google par les clients de CE marché précis. Mélange requêtes produit, requêtes "logiciel/outil", requêtes problème et requêtes comparatif. Jamais de nom de marque.
2) "requiredTokens" : 8 à 14 mots ou expressions (1 à 3 mots) dont la présence prouve qu'une requête appartient à ce marché. Racines courtes de préférence.
3) "excludeTokens" : 5 à 10 mots qui signalent une requête HORS de ce marché (autres métiers, sujets administratifs ou grand public proches lexicalement).

Français, minuscules, sans accent obligatoire.
JSON strict : {"marketTerms":["..."],"requiredTokens":["..."],"excludeTokens":["..."]}`,
  });

  const parsed = parseJsonLoose(raw);
  const clean = (v: any, max: number, maxLen: number) =>
    (Array.isArray(v) ? v : [])
      .map((x) => normalizeKw(String(x)))
      .filter((x) => x.length > 1 && x.length <= maxLen)
      .slice(0, max);

  return {
    marketTerms: clean(parsed?.marketTerms, 20, 70),
    requiredTokens: clean(parsed?.requiredTokens, 14, 40),
    excludeTokens: clean(parsed?.excludeTokens, 10, 40),
  };
}

/**
 * Garde déterministe. Sans lexique exploitable, on n'invente pas de filtre :
 * on retombe sur le refus du seul bruit administratif.
 */
export function makeRelevanceFilter(lexicon?: MarketLexicon | null) {
  const required = (lexicon?.requiredTokens ?? []).filter(Boolean);
  const excluded = (lexicon?.excludeTokens ?? []).filter(Boolean);

  return (keyword: string): boolean => {
    const kw = normalizeKw(keyword);
    if (!kw || kw.length < 3) return false;
    if (ADMIN_NOISE.test(kw)) return false;
    if (excluded.some((t) => kw.includes(t))) return false;
    if (required.length === 0) return true;
    return required.some((t) => kw.includes(t));
  };
}
