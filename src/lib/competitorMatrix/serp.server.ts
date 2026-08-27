// Étape 4 — relevés SERP : positions organiques de tous les domaines de la
// matrice + domaines cités par l'AI Overview (position 0).
// Si la donnée manque, l'état reste explicitement nul, jamais reconstitué.

import { dfsPost, cleanDomain } from './dfs.server';
import { LOCATION_FR, type SerpReadingJson } from './types';

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
  const tasks = keywords.slice(0, 20).map((keyword) => ({
    keyword,
    location_code: LOCATION_FR,
    language_code: 'fr',
    se_domain: 'google.fr',
    depth: 30,
    people_also_ask_click_depth: 0,
    load_async_ai_overview: true,
  }));
  if (tasks.length === 0) return [];

  const data = await dfsPost('serp/google/organic/live/advanced', tasks, 90000);

  return tasks.map((task, i) => {
    const result = data?.tasks?.[i]?.result?.[0];
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
      keyword: task.keyword,
      positions,
      aiOverview: { keyword: task.keyword, triggered, domains: [...aiDomains].slice(0, 8) },
    };
  });
}
