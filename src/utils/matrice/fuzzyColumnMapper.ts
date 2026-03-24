/**
 * Fuzzy Column Mapper for Matrice imports.
 * Maps arbitrary CSV/XLSX column headers to MatrixRow fields
 * using fuzzy string matching + content type analysis.
 */

// ── Known field aliases (lowercase) ─────────────────────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  prompt: [
    'prompt', 'kpi', 'critère', 'critere', 'criteria', 'criterion',
    'indicateur', 'indicator', 'metric', 'métrique', 'metrique',
    'question', 'check', 'vérification', 'verification', 'test',
    'audit point', 'point d\'audit', 'règle', 'regle', 'rule',
    'label', 'nom', 'name', 'description', 'item', 'élément', 'element',
    'what to check', 'quoi vérifier', 'objectif', 'objective',
    'aller_vite', 'aller vite', 'libellé', 'libelle', 'intitulé', 'intitule',
    'titre', 'title', 'sujet', 'subject',
  ],
  poids: [
    'poids', 'weight', 'pondération', 'ponderation', 'pond', 'w',
    'importance', 'priority', 'priorité', 'priorite', 'coeff',
    'coefficient', 'factor', 'facteur', 'multiplier',
  ],
  axe: [
    'axe', 'axis', 'catégorie', 'categorie', 'category', 'cat',
    'domaine', 'domain', 'section', 'groupe', 'group', 'type',
    'pilier', 'pillar', 'thème', 'theme', 'topic', 'famille', 'family',
    'rubrique', 'thématique', 'thematique', 'sous-thème', 'sous-theme',
    'volet', 'classe', 'class', 'segment', 'dimension', 'area',
    'branche', 'branch', 'module', 'aspect', 'champ', 'field',
  ],
  seuil_bon: [
    'seuil_bon', 'seuil bon', 'threshold good', 'bon', 'good',
    'green', 'vert', 'pass', 'réussi', 'reussi', 'seuil haut',
    'high threshold', 'target', 'cible', 'objectif score',
  ],
  seuil_moyen: [
    'seuil_moyen', 'seuil moyen', 'threshold medium', 'moyen', 'medium',
    'orange', 'warning', 'attention', 'seuil intermédiaire',
    'mid threshold', 'acceptable',
  ],
  seuil_mauvais: [
    'seuil_mauvais', 'seuil mauvais', 'threshold bad', 'mauvais', 'bad',
    'rouge', 'red', 'fail', 'échec', 'echoue', 'seuil bas',
    'low threshold', 'minimum', 'min',
  ],
  llm_name: [
    'llm_name', 'llm', 'model', 'modèle', 'modele', 'ai model',
    'moteur', 'engine', 'ia', 'ai',
  ],
};

// ── Result-file detection keywords (columns to skip) ────────────────────
const RESULT_COLUMN_PATTERNS = [
  /score/i, /mentionne/i, /cit[eé]/i, /recommand/i, /rang/i,
  /url_/i, /type_de_source/i, /prioritaire/i, /^id$/i,
  /chatgpt/i, /gemini/i, /perplexity/i, /copilot/i, /claude/i,
  /result/i, /résultat/i, /found/i, /trouvé/i, /brand/i, /marque/i,
];

// ── Fuzzy similarity (Dice coefficient on bigrams) ──────────────────────
function bigrams(s: string): Set<string> {
  const bg = new Set<string>();
  const lower = s.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '');
  for (let i = 0; i < lower.length - 1; i++) {
    bg.add(lower.substring(i, i + 2));
  }
  return bg;
}

function diceSimilarity(a: string, b: string): number {
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  if (bgA.size === 0 && bgB.size === 0) return 1;
  if (bgA.size === 0 || bgB.size === 0) return 0;
  let intersection = 0;
  bgA.forEach(bg => { if (bgB.has(bg)) intersection++; });
  return (2 * intersection) / (bgA.size + bgB.size);
}

// ── Content type analysis ───────────────────────────────────────────────
type ContentType = 'numeric_small' | 'numeric_large' | 'text_short' | 'text_long' | 'mixed' | 'empty';

function analyzeColumnContent(values: any[]): ContentType {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'empty';

  let numCount = 0;
  let numSum = 0;
  let textLengthSum = 0;

  for (const v of nonEmpty) {
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== '') {
      numCount++;
      numSum += Math.abs(n);
    }
    textLengthSum += String(v).length;
  }

  const numRatio = numCount / nonEmpty.length;
  const avgTextLen = textLengthSum / nonEmpty.length;

  if (numRatio > 0.7) {
    const avgNum = numSum / numCount;
    return avgNum <= 100 ? 'numeric_small' : 'numeric_large';
  }
  if (avgTextLen > 30) return 'text_long';
  if (avgTextLen > 0) return 'text_short';
  return 'mixed';
}

// ── Content-based field inference ────────────────────────────────────────
function inferFieldFromContent(contentType: ContentType, columnIndex: number, totalColumns: number): string | null {
  // First text column with long text → probably the prompt/KPI name
  if (contentType === 'text_long') return 'prompt';
  // Short text → could be axe/category
  if (contentType === 'text_short') return 'axe';
  // Small numbers (0-100) → thresholds or weight
  if (contentType === 'numeric_small') return null; // ambiguous, needs header
  return null;
}

// ── Main mapper ─────────────────────────────────────────────────────────
export interface ColumnMapping {
  field: string;        // MatrixRow field name
  confidence: number;   // 0-1 confidence score
  source: 'header' | 'content' | 'position';
}

export interface MappingResult {
  mappings: Record<string, ColumnMapping>; // columnName → mapping
  unmapped: string[];                        // columns we couldn't map
  warnings: string[];                        // human-readable warnings
}

export function mapColumns(
  headers: string[],
  sampleRows: Record<string, any>[],
): MappingResult {
  const mappings: Record<string, ColumnMapping> = {};
  const usedFields = new Set<string>();
  const warnings: string[] = [];

  // Phase 0: Detect result-type files (many score/result columns)
  const resultColCount = headers.filter(h =>
    RESULT_COLUMN_PATTERNS.some(p => p.test(h))
  ).length;
  const isResultFile = resultColCount > headers.length * 0.4;

  if (isResultFile) {
    warnings.push('Fichier de résultats détecté — extraction des critères uniquement');
    // In result files, find the "label" column (short descriptive text, not a score)
    const candidateHeaders = headers.filter(h =>
      !RESULT_COLUMN_PATTERNS.some(p => p.test(h))
    );
    // Pick the best text column from non-result columns
    if (candidateHeaders.length > 0 && sampleRows.length > 0) {
      let bestHeader = candidateHeaders[0];
      let bestAvgLen = 0;
      for (const h of candidateHeaders) {
        const avgLen = sampleRows.reduce((sum, r) => sum + String(r[h] ?? '').length, 0) / sampleRows.length;
        if (avgLen > bestAvgLen) { bestAvgLen = avgLen; bestHeader = h; }
      }
      mappings[bestHeader] = { field: 'prompt', confidence: 0.7, source: 'content' };
      usedFields.add('prompt');
    }
    // Skip all result columns — return early with just prompt mapped
    const unmapped = headers.filter(h => !mappings[h]);
    return { mappings, unmapped, warnings };
  }

  // Phase 1: Fuzzy match on headers
  for (const header of headers) {
    const headerLower = header.toLowerCase().trim();
    let bestField = '';
    let bestScore = 0;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      // Exact match
      if (aliases.includes(headerLower)) {
        bestField = field;
        bestScore = 1;
        break;
      }
      // Fuzzy match
      for (const alias of aliases) {
        const score = diceSimilarity(headerLower, alias);
        const containsBonus = headerLower.includes(alias) || alias.includes(headerLower) ? 0.2 : 0;
        const total = Math.min(1, score + containsBonus);
        if (total > bestScore) {
          bestScore = total;
          bestField = field;
        }
      }
    }

    if (bestScore >= 0.45 && !usedFields.has(bestField)) {
      mappings[header] = { field: bestField, confidence: bestScore, source: 'header' };
      usedFields.add(bestField);
    }
  }

  // Phase 2: Content analysis for unmapped columns
  const unmappedHeaders = headers.filter(h => !mappings[h]);
  if (unmappedHeaders.length > 0 && sampleRows.length > 0) {
    const contentAnalysis: { header: string; type: ContentType }[] = [];

    for (const header of unmappedHeaders) {
      const values = sampleRows.map(row => row[header]);
      const type = analyzeColumnContent(values);
      contentAnalysis.push({ header, type });
    }

    if (!usedFields.has('prompt')) {
      const textLong = contentAnalysis.find(c => c.type === 'text_long');
      const textShort = contentAnalysis.find(c => c.type === 'text_short');
      const candidate = textLong || textShort;
      if (candidate) {
        mappings[candidate.header] = { field: 'prompt', confidence: 0.6, source: 'content' };
        usedFields.add('prompt');
        contentAnalysis.splice(contentAnalysis.indexOf(candidate), 1);
      }
    }

    if (!usedFields.has('axe')) {
      const textShort = contentAnalysis.find(c => c.type === 'text_short');
      if (textShort) {
        mappings[textShort.header] = { field: 'axe', confidence: 0.5, source: 'content' };
        usedFields.add('axe');
        contentAnalysis.splice(contentAnalysis.indexOf(textShort), 1);
      }
    }

    const numericCols = contentAnalysis.filter(c => c.type === 'numeric_small');
    const numericFields = ['poids', 'seuil_bon', 'seuil_moyen', 'seuil_mauvais'].filter(f => !usedFields.has(f));
    for (let i = 0; i < Math.min(numericCols.length, numericFields.length); i++) {
      mappings[numericCols[i].header] = { field: numericFields[i], confidence: 0.4, source: 'content' };
      usedFields.add(numericFields[i]);
    }
  }

  // Phase 3: Positional fallback — if still no prompt, use first column
  if (!usedFields.has('prompt') && headers.length > 0) {
    const firstUnmapped = headers.find(h => !mappings[h]) || headers[0];
    if (!mappings[firstUnmapped]) {
      mappings[firstUnmapped] = { field: 'prompt', confidence: 0.3, source: 'position' };
      usedFields.add('prompt');
      warnings.push(`Colonne "${firstUnmapped}" utilisée comme KPI par défaut (position)`);
    }
  }

  // Generate warnings for low-confidence mappings
  for (const [header, mapping] of Object.entries(mappings)) {
    if (mapping.confidence < 0.5) {
      warnings.push(`Colonne "${header}" → ${mapping.field} (confiance ${Math.round(mapping.confidence * 100)}%)`);
    }
  }

  const unmapped = headers.filter(h => !mappings[h]);

  return { mappings, unmapped, warnings };
}

/**
 * Transform raw imported rows using fuzzy column mappings.
 * Returns properly structured MatrixRow-compatible objects.
 */
export function transformRows(
  rawRows: Record<string, any>[],
  mappingResult: MappingResult,
): Record<string, any>[] {
  const { mappings } = mappingResult;

  // Build reverse map: field → column header
  const fieldToHeader: Record<string, string> = {};
  for (const [header, mapping] of Object.entries(mappings)) {
    fieldToHeader[mapping.field] = header;
  }

  return rawRows.map(raw => {
    const result: Record<string, any> = {};
    for (const field of Object.keys(FIELD_ALIASES)) {
      const header = fieldToHeader[field];
      if (header && raw[header] !== undefined && raw[header] !== null && String(raw[header]).trim() !== '') {
        result[field] = raw[header];
      }
    }
    return result;
  });
}
