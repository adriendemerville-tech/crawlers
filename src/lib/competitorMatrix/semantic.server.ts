// Analyse sémantique des pages (cible + concurrents) pour la matrice de
// concurrence : structure Hn, balisage Schema.org, passages citables.
// 100 % déterministe — aucun appel LLM, aucun coût DataForSEO.
// Chaque domaine est lu sur sa page d'accueil servie (HTML brut).

import type { Competitor, SemanticReading } from './types';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RIVALS = 5;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0)', accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) return '';
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('html')) return '';
  return await res.text();
}

function stripHead(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

/** Types Schema.org extraits des blocs JSON-LD (gère @graph, tableaux, objets imbriqués). */
function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const walk = (node: unknown, depth: number) => {
      if (depth > 6 || node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach((n) => walk(n, depth + 1));
        return;
      }
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string') types.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.add(x));
      if ('@graph' in obj) walk(obj['@graph'], depth + 1);
    };
    walk(parsed, 0);
  }
  return [...types];
}

/** Phrases citables : 40-250 caractères, avec donnée, source ou assertion de valeur. */
function countCitablePassages(html: string): number {
  const text = stripHead(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.filter((s) => {
    const t = s.trim();
    if (t.length < 40 || t.length > 250) return false;
    if (/\d+\s*(%|€|millions?|milliards?)/.test(t)) return true;
    if (/selon|d'après|étude|research|study|report/i.test(t)) return true;
    if (/leader|meilleur|best|top|premier|première|unique/i.test(t)) return true;
    if (/permet|propose|garantit|enables|offers/i.test(t)) return true;
    return false;
  }).length;
}

export function analyzeSemanticHtml(domain: string, isTarget: boolean, html: string): SemanticReading {
  if (!html) {
    return {
      domain, isTarget, fetched: false, score: null,
      schemaTypes: [], schemaCount: 0, hasGraph: false, hasFAQSchema: false,
      hasOrganization: false, h1Count: 0, h2Count: 0, h3Count: 0,
      listCount: 0, tableCount: 0, hasToc: false, citablePassages: 0,
    };
  }

  const schemaTypes = extractSchemaTypes(html);
  const hasGraph = /"@graph"/i.test(html);
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const h2Count = (html.match(/<h2[\s>]/gi) ?? []).length;
  const h3Count = (html.match(/<h3[\s>]/gi) ?? []).length;
  const listCount = (html.match(/<[uo]l[\s>]/gi) ?? []).length;
  const tableCount = (html.match(/<table[\s>]/gi) ?? []).length;
  const hasToc = /sommaire|table[- ]?of[- ]?contents|table des matières/i.test(html);
  const hasFAQSection = /<h[23][^>]*>[^<]*(faq|questions? fr[ée]quent|foire aux questions)/i.test(html);
  const hasFAQSchema = schemaTypes.includes('FAQPage');
  const hasOrganization = schemaTypes.includes('Organization') || schemaTypes.includes('LocalBusiness');
  const citablePassages = countCitablePassages(html);

  // Score /100 : structure éditoriale + balisage + citabilité.
  let score = 0;
  if (h1Count === 1) score += 10;
  if (h2Count >= 2) score += 10;
  if (h3Count >= 1) score += 5;
  if (hasFAQSection) score += 10;
  if (hasFAQSchema) score += 5;
  if (listCount >= 1) score += 5;
  if (tableCount >= 1) score += 5;
  if (hasToc) score += 10;
  if (schemaTypes.length > 0) score += 15;
  if (hasGraph) score += 5;
  if (hasOrganization) score += 5;
  if (citablePassages >= 3) score += 15;
  else if (citablePassages >= 1) score += 8;
  score = Math.min(100, score);

  return {
    domain, isTarget, fetched: true, score,
    schemaTypes: schemaTypes.slice(0, 12),
    schemaCount: schemaTypes.length,
    hasGraph, hasFAQSchema, hasOrganization,
    h1Count, h2Count, h3Count, listCount, tableCount, hasToc, citablePassages,
  };
}

/**
 * Lit la page d'accueil de la cible et de ses concurrents (max 5), en parallèle.
 * Un domaine injoignable sort avec `fetched: false` — il est déclaré, jamais estimé.
 */
export async function readSemanticPresentations(
  domain: string,
  competitors: Competitor[],
): Promise<SemanticReading[]> {
  const rivals = competitors
    .filter((c) => c.domain && c.domain !== domain)
    .slice(0, MAX_RIVALS);

  const entries: { domain: string; isTarget: boolean; url: string }[] = [
    { domain, isTarget: true, url: `https://${domain}/` },
    ...rivals.map((c) => ({ domain: c.domain, isTarget: false, url: `https://${c.domain}/` })),
  ];

  const settled = await Promise.allSettled(
    entries.map((e) => fetchHtml(e.url)),
  );

  return entries.map((e, i) => {
    const html = settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<string>).value : '';
    return analyzeSemanticHtml(e.domain, e.isTarget, html);
  });
}
