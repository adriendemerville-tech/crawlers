/**
 * Génère supabase/functions/_shared/techDocIndex.ts à partir de
 * src/data/backendDocumentation.ts (source unique de la doc technique).
 *
 * Usage : bun run scripts/gen-tech-doc-index.ts
 * À relancer après chaque mise à jour de la documentation technique.
 */
import { writeFileSync } from 'node:fs';
import { backendDocSections } from '../src/data/backendDocumentation';

const MAX_CHARS_PER_SECTION = 9000;

const sections = backendDocSections.map((s) => ({
  id: s.id,
  title: s.title,
  content: s.content.trim().slice(0, MAX_CHARS_PER_SECTION),
}));

const header = `// AUTO-GÉNÉRÉ par scripts/gen-tech-doc-index.ts — ne pas éditer à la main.
// Source : src/data/backendDocumentation.ts
// Régénérer : bun run scripts/gen-tech-doc-index.ts
export interface TechDocSection { id: string; title: string; content: string }

export const TECH_DOC_SECTIONS: TechDocSection[] = ${JSON.stringify(sections, null, 2)};

const STOP = new Set(['pour','avec','dans','les','des','une','sur','par','aux','que','qui','est','son','ses','crawlers','the','and','for']);

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/**
 * Sélectionne les extraits de doc technique les plus pertinents pour une requête
 * (titre + description d'une feature), en limitant strictement le nombre de
 * caractères injectés dans le prompt LLM (économie de tokens).
 */
export function selectTechDoc(
  query: string,
  opts: { sectionIds?: string[] | null; maxChars?: number; maxSections?: number } = {},
): { text: string; usedSections: string[] } {
  const maxChars = opts.maxChars ?? 4500;
  const maxSections = opts.maxSections ?? 3;
  const pinned = (opts.sectionIds ?? []).filter(Boolean);
  const words = tokens(query);

  const scored = TECH_DOC_SECTIONS.map((s) => {
    if (pinned.includes(s.id)) return { s, score: 10_000 };
    const hay = (s.title + ' ' + s.content).toLowerCase();
    let score = 0;
    for (const w of words) {
      const n = hay.split(w).length - 1;
      if (n > 0) score += Math.min(n, 8);
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections);

  if (!scored.length) return { text: '', usedSections: [] };

  const budget = Math.floor(maxChars / scored.length);
  const parts: string[] = [];
  for (const { s } of scored) {
    parts.push('### ' + s.title + '\\n' + extractRelevant(s.content, words, budget));
  }
  return { text: parts.join('\\n\\n'), usedSections: scored.map((x) => x.s.id) };
}

/** Garde les paragraphes contenant le plus de mots-clés, jusqu'au budget. */
function extractRelevant(content: string, words: string[], budget: number): string {
  const blocks = content.split(/\\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const ranked = blocks
    .map((b, i) => {
      const low = b.toLowerCase();
      let sc = 0;
      for (const w of words) if (low.includes(w)) sc += 1;
      return { b, i, sc };
    })
    .sort((a, b) => b.sc - a.sc || a.i - b.i);

  const kept: { b: string; i: number }[] = [];
  let used = 0;
  for (const r of ranked) {
    if (used + r.b.length > budget) continue;
    kept.push(r);
    used += r.b.length;
    if (used >= budget * 0.9) break;
  }
  return kept.sort((a, b) => a.i - b.i).map((k) => k.b).join('\\n\\n');
}
`;

writeFileSync('supabase/functions/_shared/techDocIndex.ts', header, 'utf8');
console.log(`techDocIndex.ts généré : ${sections.length} sections, ${header.length} caractères.`);
