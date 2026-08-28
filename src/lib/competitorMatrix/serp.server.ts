// Étape 4 — relevés SERP : positions organiques de tous les domaines de la
// matrice + domaines cités par l'AI Overview (position 0).
// Si la donnée manque, l'état reste explicitement nul, jamais reconstitué.
//
// Contrainte DataForSEO (vérifiée en production) : les endpoints `live`
// n'acceptent QU'UNE seule tâche par requête ("You can set only one task at a
// time") et rejettent `people_also_ask_click_depth` sur organic/live/advanced.
// Un batch multi-tâches renvoyait donc systématiquement zéro résultat : aucun
// leader ne pouvait être mesuré. On envoie donc une requête par mot-clé, par
// lots parallèles bornés.

import { dfsPost, cleanDomain } from './dfs.server';
import { LOCATION_FR, SEED_SERP_KEYWORDS, type SeedSerpReading, type SerpReadingJson } from './types';

const SERP_CONCURRENCY = 5;

function serpTask(keyword: string, aiOverview: boolean) {
  return {
    keyword: keyword.slice(0, 200),
    location_code: LOCATION_FR,
    language_code: 'fr',
    se_domain: 'google.fr',
    depth: 30,
    ...(aiOverview ? { load_async_ai_overview: true } : {}),
  };
}

/** Un appel = une tâche. Lots parallèles bornés pour rester sous le timeout. */
async function readOne(keyword: string, aiOverview: boolean): Promise<any | null> {
  const data = await dfsPost('serp/google/organic/live/advanced', [serpTask(keyword, aiOverview)], 45000);
  const task = data?.tasks?.[0];
  if (!task) return null;
  if (task.status_code !== 20000) {
    console.error(`[competitor-matrix] SERP "${keyword}" status ${task.status_code} ${task.status_message}`);
    return null;
  }
  return task.result?.[0] ?? null;
}

async function readMany(keywords: string[], aiOverview: boolean): Promise<(any | null)[]> {
  const out: (any | null)[] = [];
  for (let i = 0; i < keywords.length; i += SERP_CONCURRENCY) {
    const chunk = keywords.slice(i, i + SERP_CONCURRENCY);
    out.push(...(await Promise.all(chunk.map((k) => readOne(k, aiOverview)))));
  }
  return out;
}

/**
 * Sélection des requêtes d'amorçage : une question conversationnelle de 100
 * caractères ne renvoie pas de SERP exploitable pour identifier un marché.
 * On privilégie les requêtes courtes (celles réellement tapées dans Google),
 * tout en gardant quelques formulations longues pour les AI Overviews.
 */
function pickSeedKeywords(keywords: string[]): string[] {
  const short = keywords.filter((k) => k.length <= 60);
  const long = keywords.filter((k) => k.length > 60);
  return [...short, ...long].slice(0, SEED_SERP_KEYWORDS);
}

/**
 * Passe 1 — relevé d'amorçage. Objectif : découvrir QUI occupe le marché,
 * donc on lit tous les domaines du top 10 (et l'AI Overview) au lieu de
 * chercher une liste de domaines déjà connue.
 */
export async function seedSerp(keywords: string[], targetDomain: string): Promise<SeedSerpReading[]> {
  const target = cleanDomain(targetDomain);
  const picked = pickSeedKeywords(keywords);
  if (picked.length === 0) return [];

  const results = await readMany(picked, true);

  return picked.map((keyword, i) => {
    const result = results[i];
    const top: { domain: string; rank: number }[] = [];
    const aiDomains = new Set<string>();
    let targetPosition: number | null = null;

    for (const item of result?.items || []) {
      if (item.type === 'ai_overview') {
        collectAiOverviewDomains(item, aiDomains);
        continue;
      }
      if (item.type !== 'organic') continue;
      const d = cleanDomain(item.domain || item.url || '');
      const rank = item.rank_group || item.rank_absolute;
      if (!d || !rank) continue;
      if (rank <= 10 && !top.some((t) => t.domain === d)) top.push({ domain: d, rank });
      if ((d === target || d.endsWith(`.${target}`)) && (targetPosition === null || rank < targetPosition)) {
        targetPosition = rank;
      }
    }

    return { keyword, top, aiDomains: [...aiDomains].slice(0, 10), targetPosition };
  });
}

function collectAiOverviewDomains(item: any, acc: Set<string>) {
  const push = (u?: string) => {
    const d = cleanDomain(u || '');
    if (d && d.includes('.')) acc.add(d);
  };
  for (const ref of item.references || []) push(ref.url || ref.domain);
  for (const sub of item.items || []) {
    push(sub.url || sub.domain);
    for (const ref of sub.references || []) push(ref.url || ref.domain);
  }
}

export async function readSerp(keywords: string[], domains: string[]): Promise<SerpReadingJson[]> {
  const wanted = domains.map(cleanDomain);
  const picked = keywords.slice(0, 20);
  if (picked.length === 0) return [];

  const results = await readMany(picked, true);

  return picked.map((keyword, i) => {
    const result = results[i];
    const positions: Record<string, number> = {};
    const aiDomains = new Set<string>();
    let triggered: boolean | null = result ? false : null;

    for (const item of result?.items || []) {
      if (item.type === 'ai_overview') {
        triggered = true;
        collectAiOverviewDomains(item, aiDomains);
        continue;
      }
      if (item.type !== 'organic') continue;
      const itemDomain = cleanDomain(item.domain || item.url || '');
      const rank = item.rank_group || item.rank_absolute;
      if (!itemDomain || !rank) continue;
      for (const w of wanted) {
        if (itemDomain === w || itemDomain.endsWith(`.${w}`)) {
          if (positions[w] === undefined || rank < positions[w]) positions[w] = rank;
        }
      }
    }

    return {
      keyword,
      positions,
      aiOverview: { keyword, triggered, domains: [...aiDomains].slice(0, 8) },
    };
  });
}
