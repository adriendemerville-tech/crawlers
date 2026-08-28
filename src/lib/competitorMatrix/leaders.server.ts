// Étape 4a — les leaders du marché sont LUS dans la SERP, pas devinés.
// Un domaine devient leader s'il occupe le top 5 (ou l'AI Overview) sur
// plusieurs requêtes d'amorçage. C'est un fait mesuré, jamais une hypothèse.

import { cleanDomain } from './dfs.server';
import { LEADER_MIN_HITS, type Competitor, type SeedSerpReading } from './types';

const BLOCKLIST = new Set([
  'google.com', 'google.fr', 'youtube.com', 'facebook.com', 'linkedin.com',
  'wikipedia.org', 'fr.wikipedia.org', 'pinterest.fr', 'pinterest.com',
  'instagram.com', 'x.com', 'twitter.com', 'amazon.fr', 'amazon.com',
  'pagesjaunes.fr', 'societe.com', 'leboncoin.fr', 'indeed.com', 'tiktok.com',
  'reddit.com', 'quora.com', 'medium.com',
]);

function usable(domain: string, self: string): boolean {
  const d = cleanDomain(domain);
  if (!d || !d.includes('.') || d.length > 80) return false;
  if (d === self || d.endsWith(`.${self}`) || self.endsWith(`.${d}`)) return false;
  return !BLOCKLIST.has(d);
}

/** Domaines vus au moins une fois dans le relevé d'amorçage (top 10 ou AI Overview). */
export function seedSerpDomains(seed: SeedSerpReading[]): Set<string> {
  const out = new Set<string>();
  for (const s of seed) {
    for (const t of s.top) out.add(t.domain);
    for (const d of s.aiDomains) out.add(d);
  }
  return out;
}

export function detectLeaders(seed: SeedSerpReading[], self: string, limit = 3): Competitor[] {
  const topHits = new Map<string, number>();
  const aiHits = new Map<string, number>();
  const bestRank = new Map<string, number>();

  for (const s of seed) {
    for (const t of s.top) {
      if (!usable(t.domain, self) || t.rank > 5) continue;
      topHits.set(t.domain, (topHits.get(t.domain) || 0) + 1);
      const prev = bestRank.get(t.domain);
      if (prev === undefined || t.rank < prev) bestRank.set(t.domain, t.rank);
    }
    for (const d of new Set(s.aiDomains)) {
      if (!usable(d, self)) continue;
      aiHits.set(d, (aiHits.get(d) || 0) + 1);
    }
  }

  const domains = new Set([...topHits.keys(), ...aiHits.keys()]);
  const scored: (Competitor & { score: number })[] = [];

  for (const d of domains) {
    const top = topHits.get(d) || 0;
    const ai = aiHits.get(d) || 0;
    if (top < LEADER_MIN_HITS && ai < LEADER_MIN_HITS) continue;
    const parts: string[] = [];
    if (top > 0) parts.push(`top 5 de Google sur ${top} requête${top > 1 ? 's' : ''} du marché`);
    if (ai > 0) parts.push(`cité par l’AI Overview sur ${ai} requête${ai > 1 ? 's' : ''}`);
    scored.push({
      domain: d,
      name: d,
      type: 'leader',
      reason: parts.join(', '),
      source: 'serp',
      // Une citation IA pèse autant qu'une position 1-5.
      score: top * 2 + ai * 2 - (bestRank.get(d) ?? 5) / 10,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...c }) => c);
}

/**
 * Quick wins : la cible est en 11-30 alors qu'un leader occupe le top 5.
 * Un mot-clé où la cible n'est pas mesurée n'est jamais un quick win.
 */
export function detectQuickWins(seed: SeedSerpReading[], leaderDomains: string[]): string[] {
  const leaders = new Set(leaderDomains);
  return seed
    .filter((s) => {
      if (s.targetPosition === null || s.targetPosition <= 10 || s.targetPosition > 30) return false;
      return s.top.some((t) => t.rank <= 5 && leaders.has(t.domain));
    })
    .map((s) => s.keyword);
}
