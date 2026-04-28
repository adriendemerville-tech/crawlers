/**
 * scoredWideUnpivot — Détecte un fichier benchmark "wide" déjà scoré
 * (1 ligne = 1 prompt, N blocs de colonnes par moteur LLM) et l'unpivot
 * en items benchmark pré-scorés, prêts à alimenter BenchmarkHeatmap /
 * BenchmarkCube3D sans relancer les LLM.
 *
 * Format reconnu (insensible à la casse) :
 *   - Une colonne "moteur" simple : ChatGPT, Gemini, Perplexity, Copilot,
 *     Claude, Mistral (verdict texte = citation_context)
 *   - Des colonnes suffixées par moteur :
 *       {Moteur}_Score_Citabilite       → score 0-100
 *       {Moteur}_Cite | _.fr_Cite       → citation_found (Oui/Non)
 *       {Moteur}_Rang…                  → citation_rank
 *       {Moteur}_Mentionne…             → fallback citation_found
 *       {Moteur}_Recommande…            → recommends
 *       {Moteur}_Type_de_Sources        → contexte additionnel
 *
 * Le "label" de chaque ligne provient de Aller_Vite > Libellé > prompt > ID.
 */

const KNOWN_ENGINES = ['ChatGPT', 'Gemini', 'Perplexity', 'Copilot', 'Claude', 'Mistral'];

const PROMPT_LABEL_FIELDS = ['Aller_Vite', 'aller_vite', 'Libellé', 'libelle', 'Libelle', 'prompt', 'Prompt', 'theme', 'Thème', 'sujet'];
const PROMPT_ID_FIELDS = ['ID', 'Id', 'id', '#', 'N°', 'Code'];

export interface ScoredBenchmarkItem {
  id: string;
  prompt: string;
  theme: string;          // = prompt label (axe X de la heatmap)
  engine: string;         // = moteur (axe Y)
  axe: string;            // = famille / onglet (axe Z du cube)
  crawlers_score: number;
  citation_found: boolean;
  citation_rank: number | null;
  citation_context: string;
  recommends?: boolean;
  raw_data?: Record<string, any>;
}

export interface ScoredWideDetection {
  detected: boolean;
  engines: string[];               // moteurs trouvés
  reason: string;                  // explication pour debug/UI
  scoreColumns: Record<string, string>;  // engine → header score
}

const yesish = (v: any): boolean => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'oui' || s === 'yes' || s === 'true' || s === '1' || s === 'y' || s === 'o' || s === '✓';
};

const numish = (v: any): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Normalise un header pour matching tolérant : lowercase, supprime espaces/_/-/./newlines */
function norm(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[\s_\-.\n\r]+/g, '');
}

function findEngineColumn(headers: string[], engine: string, suffixRegex: RegExp): string | null {
  const eng = norm(engine);
  for (const h of headers) {
    const n = norm(h);
    if (n.startsWith(eng) && suffixRegex.test(n)) return h;
  }
  return null;
}

/**
 * Détecte si l'ensemble de headers correspond à un format scored-wide.
 * Critère minimal : ≥ 2 moteurs avec une colonne "_Score_Citabilite" ou
 * équivalent (_score, _note).
 */
export function detectScoredWide(headers: string[]): ScoredWideDetection {
  const scoreColumns: Record<string, string> = {};
  // Suffixes acceptés (post-normalisation, donc sans séparateurs) :
  // scorecitabilite, scorecitab, scorecit, scoremoyen, score, note
  const scoreRe = /(scorecitab|scorecit|scoremoyen|score$|note$)/i;

  for (const eng of KNOWN_ENGINES) {
    const col = findEngineColumn(headers, eng, scoreRe);
    if (col) scoreColumns[eng] = col;
  }

  const engines = Object.keys(scoreColumns);
  if (engines.length >= 2) {
    console.log('[scoredWideUnpivot] Détecté:', engines, 'depuis', headers.length, 'headers');
    return {
      detected: true,
      engines,
      reason: `Format pré-scoré détecté : ${engines.length} moteurs (${engines.join(', ')})`,
      scoreColumns,
    };
  }
  console.log('[scoredWideUnpivot] Non détecté. Headers:', headers.slice(0, 20));
  return { detected: false, engines, reason: 'Aucun bloc moteur scoré détecté', scoreColumns };
}

function getRowLabel(row: Record<string, any>, fallbackIndex: number): { id: string; label: string } {
  const id = PROMPT_ID_FIELDS.map(f => row[f]).find(v => v != null && String(v).trim() !== '');
  const label = PROMPT_LABEL_FIELDS.map(f => row[f]).find(v => v != null && String(v).trim() !== '');
  return {
    id: id ? String(id).trim() : `P${String(fallbackIndex + 1).padStart(2, '0')}`,
    label: label ? String(label).trim() : (id ? String(id).trim() : `Prompt ${fallbackIndex + 1}`),
  };
}

/**
 * Unpivot : N lignes × M moteurs → N×M items benchmark.
 */
export function unpivotScoredWide(
  rows: Record<string, any>[],
  detection: ScoredWideDetection,
): ScoredBenchmarkItem[] {
  if (!detection.detected || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  // Pré-calcule pour chaque moteur les colonnes suffixées qui nous intéressent
  const engineColumns = detection.engines.map(eng => ({
    engine: eng,
    score: detection.scoreColumns[eng],
    verdict: findEngineColumn(headers, eng, /.*/) /* la colonne nue "ChatGPT" si elle existe */,
    cite: findEngineColumn(headers, eng, /(_cite$|\.fr_cite$|_cit[eé]e?$)/i),
    rank: findEngineColumn(headers, eng, /(_rang|rank)/i),
    mentionne: findEngineColumn(headers, eng, /(_mention)/i),
    recommande: findEngineColumn(headers, eng, /(_recommand|recommend)/i),
    typeSrc: findEngineColumn(headers, eng, /(type_de_source|sources?)/i),
    url: findEngineColumn(headers, eng, /(_url)/i),
  }));

  // Recherche la colonne "verdict" plus précisément : exactement le nom du moteur
  for (const ec of engineColumns) {
    const exact = headers.find(h => h.toLowerCase() === ec.engine.toLowerCase());
    if (exact) ec.verdict = exact;
  }

  const items: ScoredBenchmarkItem[] = [];
  rows.forEach((row, idx) => {
    const { id: rowId, label } = getRowLabel(row, idx);
    const axe = String(row.axe ?? row.Axe ?? row._source_sheet ?? 'Général').trim() || 'Général';

    for (const ec of engineColumns) {
      const score = numish(row[ec.score]) ?? -1;
      const cited = ec.cite ? yesish(row[ec.cite]) : (ec.mentionne ? yesish(row[ec.mentionne]) : false);
      const rank = ec.rank ? numish(row[ec.rank]) : null;
      const verdict = ec.verdict ? String(row[ec.verdict] ?? '').trim() : '';
      const recommends = ec.recommande ? yesish(row[ec.recommande]) : false;
      const typeSrc = ec.typeSrc ? String(row[ec.typeSrc] ?? '').trim() : '';

      items.push({
        id: `${rowId}__${ec.engine}`,
        prompt: label,
        theme: label,                // X axis = prompt
        engine: ec.engine,           // Y axis = moteur
        axe,                         // Z axis = famille
        crawlers_score: score < 0 ? 0 : score,
        citation_found: cited,
        citation_rank: rank,
        citation_context: verdict || (recommends ? 'Recommandée' : (cited ? 'Citée' : 'Non citée')),
        recommends,
        raw_data: {
          source: 'scored_wide_import',
          row_id: rowId,
          type_sources: typeSrc,
          engine_response_preview: verdict,
        },
      });
    }
  });

  return items;
}

/**
 * Construit la payload complète attendue par BenchmarkHeatmap (themes,
 * engines, heatmap, global_score, citation_rate) à partir d'items unpivotés.
 */
export function buildBenchmarkPayloadFromItems(items: ScoredBenchmarkItem[]) {
  const themeOrder: string[] = [];
  const engineOrder: string[] = [];
  const seenT = new Set<string>();
  const seenE = new Set<string>();
  for (const it of items) {
    if (!seenT.has(it.theme)) { seenT.add(it.theme); themeOrder.push(it.theme); }
    if (!seenE.has(it.engine)) { seenE.add(it.engine); engineOrder.push(it.engine); }
  }

  const heatmap: Record<string, Record<string, { score: number; cited: boolean; rank: number | null; count: number; cited_count: number }>> = {};
  for (const theme of themeOrder) {
    heatmap[theme] = {};
    for (const engine of engineOrder) {
      const matches = items.filter(i => i.theme === theme && i.engine === engine);
      if (matches.length === 0) {
        heatmap[theme][engine] = { score: -1, cited: false, rank: null, count: 0, cited_count: 0 };
      } else {
        const citedCount = matches.filter(m => m.citation_found).length;
        const bestRank = matches
          .map(m => m.citation_rank)
          .filter((r): r is number => typeof r === 'number')
          .sort((a, b) => a - b)[0] ?? null;
        const avgScore = Math.round(matches.reduce((s, m) => s + (m.crawlers_score ?? 0), 0) / matches.length);
        heatmap[theme][engine] = { score: avgScore, cited: citedCount > 0, rank: bestRank, count: matches.length, cited_count: citedCount };
      }
    }
  }

  const totalCited = items.filter(i => i.citation_found).length;
  const citationRate = items.length > 0 ? Math.round((totalCited / items.length) * 100) : 0;
  const validScores = items.map(i => i.crawlers_score).filter(s => typeof s === 'number' && s >= 0);
  const globalScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;

  // Convert items → BenchmarkResult shape expected by BenchmarkHeatmap
  const results = items.map(it => ({
    id: it.id,
    prompt: it.prompt,
    theme: it.theme,
    engine: it.engine,
    axe: it.axe,
    crawlers_score: it.crawlers_score,
    citation_found: it.citation_found,
    citation_rank: it.citation_rank,
    citation_context: it.citation_context,
    raw_data: it.raw_data,
  }));

  return {
    results,
    themes: themeOrder,
    engines: engineOrder,
    heatmap,
    globalScore,
    citationRate,
  };
}
