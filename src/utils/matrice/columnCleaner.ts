/**
 * Column Cleaner — removes result/residual columns from imported data
 * before sending to the parsing edge function.
 * Runs client-side, fast, no network.
 */

// ── Patterns that identify columns to REMOVE ────────────────────────
const REMOVE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // URLs & paths
  { pattern: /^url$/i, reason: 'URL column' },
  { pattern: /url_/i, reason: 'URL-related column' },
  { pattern: /^https?:\/\//i, reason: 'URL value' },
  { pattern: /^lien/i, reason: 'Link column' },
  { pattern: /^link/i, reason: 'Link column' },
  { pattern: /^page$/i, reason: 'Page column' },
  { pattern: /^path$/i, reason: 'Path column' },

  // Scores & results
  { pattern: /^score_/i, reason: 'Score result' },
  { pattern: /_score$/i, reason: 'Score result' },
  { pattern: /score_moyen/i, reason: 'Average score' },
  { pattern: /score_citabilite/i, reason: 'Citability score' },
  { pattern: /^note$/i, reason: 'Rating' },
  { pattern: /^rating$/i, reason: 'Rating' },

  // Boolean/status results
  { pattern: /_mentionne$/i, reason: 'Mention result' },
  { pattern: /_cit[eé]$/i, reason: 'Citation result' },
  { pattern: /_recommand/i, reason: 'Recommendation result' },
  { pattern: /prompt_prioritaire/i, reason: 'Priority flag' },

  // Rank positions
  { pattern: /^rang_/i, reason: 'Rank result' },
  { pattern: /_rang_/i, reason: 'Rank result' },
  { pattern: /^rank$/i, reason: 'Rank column' },
  { pattern: /^position$/i, reason: 'Position column' },

  // Source type results
  { pattern: /type_de_source/i, reason: 'Source type result' },

  // IDs & technical refs
  { pattern: /^id$/i, reason: 'ID column' },
  { pattern: /^ref$/i, reason: 'Reference column' },
  { pattern: /^code$/i, reason: 'Code column' },

  // Dates
  { pattern: /^date$/i, reason: 'Date column' },
  { pattern: /^created/i, reason: 'Timestamp' },
  { pattern: /^updated/i, reason: 'Timestamp' },
  { pattern: /^crawl_date/i, reason: 'Crawl date' },

  // HTTP status
  { pattern: /^status$/i, reason: 'HTTP status' },
  { pattern: /^http_status/i, reason: 'HTTP status' },
  { pattern: /^status_code/i, reason: 'Status code' },

  // LLM verbose summaries (long per-engine text)
  { pattern: /^chatgpt$/i, reason: 'LLM verbose response' },
  { pattern: /^gemini$/i, reason: 'LLM verbose response' },
  { pattern: /^perplexity$/i, reason: 'LLM verbose response' },
  { pattern: /^copilot$/i, reason: 'LLM verbose response' },
  { pattern: /^claude$/i, reason: 'LLM verbose response' },
];

// ── Patterns for VALUE-level cleaning (individual cell content) ──────
const VALUE_REMOVE_PATTERNS: RegExp[] = [
  /^https?:\/\/.+/,                    // Full URLs
  /^\/[a-z0-9\-\/]+/i,                 // Relative paths
  /^\{.*"@type".*\}/s,                 // JSON-LD
  /^\{.*"@context".*\}/s,              // JSON-LD
  /^<[a-z][^>]*>/i,                    // HTML tags
  /^\d{4}-\d{2}-\d{2}/,               // ISO dates
  /^[A-Z][a-z]+ \d{1,2}, \d{4}/,      // English dates
];

export interface CleaningResult {
  cleanedRows: Record<string, any>[];
  removedColumns: { header: string; reason: string }[];
  keptColumns: string[];
  stats: {
    originalColumns: number;
    removedColumns: number;
    keptColumns: number;
    originalRows: number;
    cleanedRows: number;
  };
}

/**
 * Clean imported rows by removing result/residual columns and values.
 */
export function cleanImportedData(
  headers: string[],
  rows: Record<string, any>[],
): CleaningResult {
  const removedColumns: { header: string; reason: string }[] = [];
  const keptColumns: string[] = [];

  // Step 1: Filter columns
  for (const h of headers) {
    const match = REMOVE_PATTERNS.find(p => p.pattern.test(h));
    if (match) {
      removedColumns.push({ header: h, reason: match.reason });
    } else {
      keptColumns.push(h);
    }
  }

  // Step 2: Detect columns that are predominantly boolean (Oui/Non, true/false)
  if (rows.length > 0) {
    const toRemove: string[] = [];
    for (const col of [...keptColumns]) {
      const values = rows.slice(0, 20).map(r => String(r[col] ?? '').trim().toLowerCase());
      const nonEmpty = values.filter(v => v !== '');
      if (nonEmpty.length === 0) continue;
      const boolCount = nonEmpty.filter(v =>
        ['oui', 'non', 'yes', 'no', 'true', 'false', '1', '0'].includes(v)
      ).length;
      if (boolCount / nonEmpty.length > 0.8) {
        toRemove.push(col);
        removedColumns.push({ header: col, reason: 'Boolean result column' });
      }
    }
    for (const col of toRemove) {
      const idx = keptColumns.indexOf(col);
      if (idx >= 0) keptColumns.splice(idx, 1);
    }
  }

  // Step 3: Build cleaned rows with only kept columns + value-level cleaning
  const cleanedRows = rows
    .map(row => {
      const cleaned: Record<string, any> = {};
      for (const col of keptColumns) {
        let val = row[col];
        if (val === null || val === undefined) continue;
        const strVal = String(val).trim();
        if (strVal === '') continue;
        // Check value-level patterns
        if (VALUE_REMOVE_PATTERNS.some(p => p.test(strVal))) continue;
        cleaned[col] = val;
      }
      return cleaned;
    })
    .filter(row => Object.keys(row).length > 0); // Remove empty rows

  return {
    cleanedRows,
    removedColumns,
    keptColumns,
    stats: {
      originalColumns: headers.length,
      removedColumns: removedColumns.length,
      keptColumns: keptColumns.length,
      originalRows: rows.length,
      cleanedRows: cleanedRows.length,
    },
  };
}
