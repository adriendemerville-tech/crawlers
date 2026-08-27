// Étape 3 — les 20 mots-clés qui structurent le marché.
// Union pondérée : couverture réelle du domaine cible + gap concurrents +
// requêtes réellement posées aux IA. Tri final déterministe.

import { aiChat, parseJsonLoose } from './ai.server';
import { dfsPost } from './dfs.server';
import { LOCATION_FR, MATRIX_KEYWORDS, type Identity, type MarketKeyword } from './types';

interface RawKw { keyword: string; volume: number; difficulty: number; origin: MarketKeyword['origin'] }

function normalize(kw: string): string {
  return kw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Déduplication sémantique légère : deux requêtes composées des mêmes mots
// significatifs comptent pour une seule colonne.
function fingerprint(kw: string): string {
  return normalize(kw).split(' ').filter((w) => w.length > 2).sort().join('-');
}

export async function fetchRankedFor(domain: string, limit = 60, origin: MarketKeyword['origin'] = 'target'): Promise<RawKw[]> {
  const data = await dfsPost('dataforseo_labs/google/ranked_keywords/live', [{
    target: domain,
    location_code: LOCATION_FR,
    language_code: 'fr',
    limit,
    order_by: ['keyword_data.keyword_info.search_volume,desc'],
    filters: ['keyword_data.keyword_info.search_volume', '>', 10],
  }]);
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  return items
    .map((item: any) => ({
      keyword: String(item.keyword_data?.keyword || ''),
      volume: item.keyword_data?.keyword_info?.search_volume || 0,
      difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? 40,
      origin,
    }))
    .filter((k: RawKw) => k.keyword.length > 2);
}

async function fetchVolumes(keywords: string[]): Promise<Map<string, { volume: number; difficulty: number }>> {
  const out = new Map<string, { volume: number; difficulty: number }>();
  if (keywords.length === 0) return out;
  const data = await dfsPost('keywords_data/google_ads/search_volume/live', [{
    keywords: keywords.slice(0, 100),
    location_code: LOCATION_FR,
    language_code: 'fr',
  }]);
  for (const item of data?.tasks?.[0]?.result || []) {
    if (!item?.keyword) continue;
    out.set(normalize(item.keyword), {
      volume: item.search_volume || 0,
      difficulty: item.competition_index ?? Math.round((item.competition || 0.3) * 100),
    });
  }
  return out;
}

// Formulations naturelles réellement posées aux IA. Le mot « site » est interdit.
export async function generateAiQueries(identity: Identity): Promise<string[]> {
  const raw = await aiChat({
    model: 'google/gemini-3.7-flash',
    json: true,
    prompt: `Activité : ${identity.activity}
Zone : ${identity.locality || 'France'}

Écris 8 questions que des clients potentiels posent réellement à ChatGPT ou Gemini pour trouver ce type d'entreprise ou de solution.
Interdits : le mot "site", le nom "${identity.name}", toute mention de SEO, de référencement ou de web.
Formulations naturelles, en français.
JSON strict : {"questions":["...","..."]}`,
  });
  const parsed = parseJsonLoose(raw);
  const list: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list
    .map((q) => String(q).trim())
    .filter((q) => q.length > 8 && q.length < 120 && !/\bsites?\b/i.test(q))
    .slice(0, 8);
}

export async function selectMarketKeywords(
  identity: Identity,
  competitorDomains: string[],
): Promise<MarketKeyword[]> {
  const targetKws = await fetchRankedFor(identity.domain, 60, 'target');

  const competitorKws: RawKw[] = [];
  for (const d of competitorDomains.slice(0, 2)) {
    competitorKws.push(...(await fetchRankedFor(d, 40, 'gap')));
  }

  const aiQueries = await generateAiQueries(identity);
  const aiVolumes = await fetchVolumes(aiQueries);
  const aiKws: RawKw[] = aiQueries.map((q) => {
    const v = aiVolumes.get(normalize(q));
    return { keyword: q, volume: v?.volume ?? 0, difficulty: v?.difficulty ?? 35, origin: 'ia' as const };
  });

  const targetFingerprints = new Set(targetKws.map((k) => fingerprint(k.keyword)));
  const seen = new Set<string>();
  const pool: MarketKeyword[] = [];

  const push = (k: RawKw, weight: number) => {
    const fp = fingerprint(k.keyword);
    if (!fp || seen.has(fp)) return;
    seen.add(fp);
    const difficulty = Math.min(Math.max(k.difficulty || 30, 5), 100);
    // Valeur = volume × pertinence ÷ difficulté.
    const value = Math.round(((k.volume + 5) * weight * 100) / difficulty);
    pool.push({ keyword: k.keyword.slice(0, 90), volume: k.volume, difficulty, value, origin: k.origin });
  };

  for (const k of targetKws) push(k, 1);
  // Le gap (mot-clé d'un concurrent que la cible n'a pas) vaut plus cher.
  for (const k of competitorKws) push(k, targetFingerprints.has(fingerprint(k.keyword)) ? 1 : 1.4);
  // Une requête réellement posée aux IA prime sur une requête purement SEO.
  for (const k of aiKws) push(k, 1.6);

  return pool.sort((a, b) => b.value - a.value).slice(0, MATRIX_KEYWORDS);
}
