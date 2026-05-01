// ============================================================================
// dictadeviContext.ts — Client serveur (Deno) pour les endpoints de contexte
// Parménion exposés par Dictadevi :
//   - GET /api/parmenion/knowledge        (chunks documentaires + cards DTU)
//   - GET /api/parmenion/lexicon          (termes longue traîne, lots, synonymes)
//   - GET /api/parmenion/catalog-ranges   (fourchettes prix par lot/unité)
//
// Auth : Authorization: Bearer ${DICTADEVI_API_KEY}
// Base : ${DICTADEVI_API_URL} (par défaut https://dictadevi.io)
//
// Utilisé par editorialPipeline.ts (Stage 2 — Writer) quand le domaine cible
// est Dictadevi, pour ancrer les normes/prix/vocabulaire dans des sources réelles.
// ============================================================================

const DEFAULT_BASE_URL = 'https://dictadevi.io';
const TIMEOUT_MS = 8000;

function getCfg(): { baseUrl: string; apiKey: string } {
  const apiKey = Deno.env.get('DICTADEVI_API_KEY');
  if (!apiKey) throw new Error('DICTADEVI_API_KEY manquant (secret Edge Functions)');
  const baseUrl = (Deno.env.get('DICTADEVI_API_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { baseUrl, apiKey };
}

async function dictadeviGet<T>(path: string, query: Record<string, string | number | string[] | undefined>): Promise<T> {
  const { baseUrl, apiKey } = getCfg();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach(x => qs.append(k, String(x)));
    else qs.set(k, String(v));
  }
  const url = `${baseUrl}/api/parmenion/${path}${qs.toString() ? `?${qs}` : ''}`;
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' };

  const attempt = async (): Promise<Response> => fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

  let resp: Response;
  try {
    resp = await attempt();
    if (resp.status >= 500) {
      console.warn(`[dictadevi-context] ${resp.status} on ${path} — retry 1×`);
      resp = await attempt();
    }
  } catch (e) {
    console.warn(`[dictadevi-context] network error on ${path} — retry 1×`, e);
    resp = await attempt();
  }

  if (resp.status === 429) {
    console.warn(`[dictadevi-context] QUOTA EXCEEDED on ${path}`);
    throw new Error(`Dictadevi quota dépassé (${path})`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Dictadevi ${path} HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  return await resp.json() as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeChunk {
  title: string;
  excerpt: string;
  source_reference?: string;
  source_page?: number | string;
  lot?: string;
  url?: string;
}
export interface DtuCard {
  term: string;
  source_reference: string;
  source_page?: number | string;
  excerpt?: string;
}
export interface KnowledgeResult {
  chunks: KnowledgeChunk[];
  cards?: DtuCard[];
}

export interface LexiconTerm {
  terme: string;
  lot?: string;
  synonymes?: string[];
  definition?: string;
}
export interface LexiconResult {
  terms: LexiconTerm[];
}

export interface CatalogRange {
  lot: string;
  unite: string;
  min: number;
  mediane: number;
  max: number;
  sample_size: number;
  monnaie?: string;
}
export interface CatalogRangesResult {
  ranges: CatalogRange[];
  disclaimer?: string;
}

export interface DictadeviContext {
  knowledge: KnowledgeResult;
  lexicon: LexiconResult;
  catalog: CatalogRangesResult;
  fetched_at: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchDictadeviKnowledge(
  q: string,
  opts: { lots?: string[]; limit?: number } = {},
): Promise<KnowledgeResult> {
  return dictadeviGet<KnowledgeResult>('knowledge', { q, lots: opts.lots, limit: opts.limit ?? 8 });
}

export async function searchDictadeviLexicon(
  q: string,
  opts: { limit?: number } = {},
): Promise<LexiconResult> {
  return dictadeviGet<LexiconResult>('lexicon', { q, limit: opts.limit ?? 12 });
}

export async function getDictadeviCatalogRanges(
  q: string,
  opts: { lot?: string; unite?: string; limit?: number } = {},
): Promise<CatalogRangesResult> {
  return dictadeviGet<CatalogRangesResult>('catalog-ranges', { q, lot: opts.lot, unite: opts.unite, limit: opts.limit ?? 10 });
}

/** Agrège les 3 endpoints en parallèle, ne lève pas si l'un échoue. */
export async function fetchDictadeviContext(q: string): Promise<DictadeviContext> {
  const [knowledge, lexicon, catalog] = await Promise.all([
    searchDictadeviKnowledge(q).catch(e => { console.warn('[dictadevi-context] knowledge failed', e); return { chunks: [] }; }),
    searchDictadeviLexicon(q).catch(e => { console.warn('[dictadevi-context] lexicon failed', e); return { terms: [] }; }),
    getDictadeviCatalogRanges(q).catch(e => { console.warn('[dictadevi-context] catalog failed', e); return { ranges: [] }; }),
  ]);
  return { knowledge, lexicon, catalog, fetched_at: new Date().toISOString() };
}

/** Sérialise le contexte en bloc texte injectable dans un system prompt. */
export function renderDictadeviContextBlock(ctx: DictadeviContext): string {
  const lines: string[] = ['<dictadevi_context>'];

  if (ctx.knowledge.chunks?.length) {
    lines.push('## Sources documentaires (chunks)');
    ctx.knowledge.chunks.slice(0, 8).forEach((c, i) => {
      lines.push(`- [${i + 1}] ${c.title}${c.source_reference ? ` — ref: ${c.source_reference}${c.source_page ? ` p.${c.source_page}` : ''}` : ''}`);
      if (c.excerpt) lines.push(`  ${c.excerpt.slice(0, 240)}`);
    });
  }
  if (ctx.knowledge.cards?.length) {
    lines.push('## Cards normes (DTU)');
    ctx.knowledge.cards.forEach(card => {
      lines.push(`- ${card.term} — source: ${card.source_reference}${card.source_page ? ` p.${card.source_page}` : ''}`);
    });
  }
  if (ctx.lexicon.terms?.length) {
    lines.push('## Lexique métier (vocabulaire exact à réutiliser pour le SEO longue traîne)');
    ctx.lexicon.terms.slice(0, 12).forEach(t => {
      const syn = t.synonymes?.length ? ` [synonymes: ${t.synonymes.join(', ')}]` : '';
      lines.push(`- ${t.terme}${t.lot ? ` (lot: ${t.lot})` : ''}${syn}`);
    });
  }
  if (ctx.catalog.ranges?.length) {
    lines.push('## Fourchettes prix (à utiliser EXCLUSIVEMENT — aucune invention de prix)');
    ctx.catalog.ranges.forEach(r => {
      lines.push(`- ${r.lot} / ${r.unite} : min ${r.min} | médiane ${r.mediane} | max ${r.max} ${r.monnaie || '€'} (n=${r.sample_size})`);
    });
    if (ctx.catalog.disclaimer) lines.push(`\n_Disclaimer prix : ${ctx.catalog.disclaimer}_`);
  }

  lines.push('</dictadevi_context>');
  return lines.join('\n');
}

/** Extrait les sources citables (pour la section "Sources" en fin d'article). */
export function extractDictadeviSources(ctx: DictadeviContext): { references: string[]; disclaimer?: string } {
  const refs = new Set<string>();
  ctx.knowledge.chunks?.forEach(c => { if (c.source_reference) refs.add(c.source_reference); });
  ctx.knowledge.cards?.forEach(c => { if (c.source_reference) refs.add(c.source_reference); });
  return { references: [...refs], disclaimer: ctx.catalog.disclaimer };
}
