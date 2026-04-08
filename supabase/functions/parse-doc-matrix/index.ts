import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { writeIdentity } from '../_shared/identityGateway.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { read, utils } from 'npm:xlsx@0.18.5';

/* ================================================================== */
/*  parse-doc-matrix — Native XLSX/CSV parser with variable detection  */
/*  Detects "Variables" sheets → enriches identity card (back only)     */
/*  Detects "Prompt Matrix" sheets → returns benchmark rows            */
/* ================================================================== */

interface VariableEntry {
  variable: string;
  value: string;
}

interface BenchmarkRow {
  prompt: string;
  theme?: string;
  engine?: string;
  poids: number;
  axe: string;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name?: string;
}

/* ── Variable field mapping to identity card ─────────────────────── */
const VARIABLE_TO_IDENTITY: Record<string, string> = {
  'nom_marque': 'brand_name',
  'brand_name': 'brand_name',
  'marque': 'brand_name',
  'nom_site': 'site_name',
  'site_name': 'site_name',
  'secteur': 'market_sector',
  'market_sector': 'market_sector',
  'segment_cible': 'target_segment',
  'target_segment': 'target_segment',
  'cible': 'target_audience',
  'target_audience': 'target_audience',
  'cas_usage': 'primary_use_case',
  'primary_use_case': 'primary_use_case',
  'use_case': 'primary_use_case',
  'localisation': 'location_detail',
  'location_detail': 'location_detail',
  'location': 'location_detail',
  'ville': 'gmb_city',
  'city': 'gmb_city',
  'url_marque': 'brand_site_url',
  'brand_site_url': 'brand_site_url',
  'brand_url': 'brand_site_url',
  'zone_commerciale': 'commercial_area',
  'commercial_area': 'commercial_area',
  'modele_commercial': 'commercial_model',
  'commercial_model': 'commercial_model',
  'type_entite': 'entity_type',
  'entity_type': 'entity_type',
  'produits_services': 'products_services',
  'products_services': 'products_services',
  'taille_entreprise': 'company_size',
  'company_size': 'company_size',
  'concurrents': 'competitors',
  'competitors': 'competitors',
  'langue': 'primary_language',
  'language': 'primary_language',
};

/* ── Sheet type detection heuristics ─────────────────────────────── */

function isVariableSheet(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase().trim());
  return lower.some(h => /^variable/i.test(h) || h === 'var' || h === 'nom') &&
    lower.some(h => /^valeur|^value|^val$/i.test(h));
}

function isBenchmarkSheet(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase().trim());
  return lower.some(h => /prompt|full_prompt|critere|critère|kpi/i.test(h)) &&
    (lower.some(h => /engine|moteur|llm/i.test(h)) ||
      lower.some(h => /theme|thème|axe|categorie|catégorie/i.test(h)));
}

function isPromptMatrixSheet(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase().trim());
  return lower.some(h => /prompt|full_prompt|critere|critère|kpi/i.test(h));
}

/* ── Parse variables from sheet ──────────────────────────────────── */

function parseVariables(rows: Record<string, any>[], headers: string[]): VariableEntry[] {
  const varCol = headers.find(h => /^variable|^var$|^nom$/i.test(h.trim()));
  const valCol = headers.find(h => /^valeur|^value|^val$/i.test(h.trim()));
  if (!varCol || !valCol) return [];

  return rows
    .filter(r => r[varCol] && r[valCol])
    .map(r => ({
      variable: String(r[varCol]).trim().toLowerCase().replace(/\s+/g, '_'),
      value: String(r[valCol]).trim(),
    }));
}

/* ── Parse benchmark rows from sheet ─────────────────────────────── */

function parseBenchmarkRows(rows: Record<string, any>[], headers: string[]): BenchmarkRow[] {
  const find = (patterns: RegExp[]) => headers.find(h => patterns.some(p => p.test(h.trim())));

  const promptCol = find([/^full_prompt$/i, /^prompt$/i, /^critere$/i, /^critère$/i, /^kpi$/i]);
  const themeCol = find([/^theme$/i, /^thème$/i, /^axe$/i, /^categorie$/i, /^catégorie$/i, /^category$/i]);
  const engineCol = find([/^engine$/i, /^moteur$/i, /^llm$/i, /^model$/i, /^modèle$/i]);
  const poidsCol = find([/^poids$/i, /^weight$/i, /^coeff$/i]);
  const seuilBonCol = find([/^seuil_bon$/i, /^bon$/i, /^good$/i]);
  const seuilMoyenCol = find([/^seuil_moyen$/i, /^moyen$/i, /^medium$/i]);
  const seuilMauvaisCol = find([/^seuil_mauvais$/i, /^mauvais$/i, /^bad$/i]);

  if (!promptCol) return [];

  return rows
    .filter(r => r[promptCol] && String(r[promptCol]).trim().length > 0)
    .map(r => ({
      prompt: String(r[promptCol]).trim(),
      theme: themeCol ? String(r[themeCol] || '').trim() : undefined,
      engine: engineCol ? String(r[engineCol] || '').trim() : undefined,
      poids: poidsCol ? Number(r[poidsCol]) || 1 : 1,
      axe: themeCol ? String(r[themeCol] || 'Général').trim() : 'Général',
      seuil_bon: seuilBonCol ? Number(r[seuilBonCol]) || 70 : 70,
      seuil_moyen: seuilMoyenCol ? Number(r[seuilMoyenCol]) || 40 : 40,
      seuil_mauvais: seuilMauvaisCol ? Number(r[seuilMauvaisCol]) || 0 : 0,
      llm_name: engineCol ? mapEngineName(String(r[engineCol] || '').trim()) : undefined,
    }));
}

/* ── Map user engine names to gateway model IDs ──────────────────── */

function mapEngineName(engine: string): string | undefined {
  if (!engine) return undefined;
  const lower = engine.toLowerCase();
  if (/chatgpt|gpt/i.test(lower)) return 'openai/gpt-5-mini';
  if (/gemini/i.test(lower)) return 'google/gemini-2.5-flash';
  if (/perplexity/i.test(lower)) return 'google/gemini-2.5-flash'; // proxy via Gemini
  if (/copilot/i.test(lower)) return 'openai/gpt-5-mini'; // proxy via GPT
  if (/claude/i.test(lower)) return 'google/gemini-2.5-flash';
  if (/mistral/i.test(lower)) return 'google/gemini-2.5-flash-lite';
  return undefined;
}

/* ── Enrich identity card from variables ─────────────────────────── */

async function enrichIdentityFromVariables(
  variables: VariableEntry[],
  trackedSiteId: string | null,
  userId: string | null,
): Promise<{ applied: string[]; skipped: string[] }> {
  if (!trackedSiteId || variables.length === 0) {
    return { applied: [], skipped: variables.map(v => v.variable) };
  }

  const fields: Record<string, unknown> = {};
  const skipped: string[] = [];

  for (const v of variables) {
    const identityField = VARIABLE_TO_IDENTITY[v.variable];
    if (identityField) {
      fields[identityField] = v.value;
    } else {
      skipped.push(v.variable);
    }
  }

  if (Object.keys(fields).length === 0) {
    return { applied: [], skipped };
  }

  try {
    const result = await writeIdentity({
      siteId: trackedSiteId,
      fields,
      source: 'matrix',
      userId: userId || undefined,
      forceDirectWrite: false, // respect hybrid mode for critical fields
    });
    return { applied: result.applied, skipped };
  } catch (e) {
    console.error('[parse-doc-matrix] Identity enrichment error:', e);
    return { applied: [], skipped };
  }
}

/* ── Generate display schema hash ────────────────────────────────── */

function generateSchemaHash(headers: string[], hasEngine: boolean, hasTheme: boolean): string {
  const sig = headers.sort().join('|') + `|engine:${hasEngine}|theme:${hasTheme}`;
  let hash = 0;
  for (let i = 0; i < sig.length; i++) {
    hash = ((hash << 5) - hash) + sig.charCodeAt(i);
    hash |= 0;
  }
  return `matrix_${Math.abs(hash).toString(36)}`;
}

/* ── Main handler ─────────────────────────────────────────────────── */

Deno.serve(handleRequest(async (req) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const trackedSiteId = formData.get('tracked_site_id') as string | null;
  const userId = formData.get('user_id') as string | null;

  if (!file) {
    return jsonError('No file provided', 400);
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  let allSheets: { name: string; headers: string[]; rows: Record<string, any>[]; sheetType: 'variable' | 'benchmark' | 'prompt' | 'unknown' }[] = [];

  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    // Native XLSX parsing with SheetJS
    const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (rows.length === 0) continue;
      const headers = Object.keys(rows[0]);

      let sheetType: 'variable' | 'benchmark' | 'prompt' | 'unknown' = 'unknown';
      if (isVariableSheet(headers)) sheetType = 'variable';
      else if (isBenchmarkSheet(headers)) sheetType = 'benchmark';
      else if (isPromptMatrixSheet(headers)) sheetType = 'prompt';

      allSheets.push({ name: sheetName, headers, rows, sheetType });
    }
  } else if (ext === 'csv') {
    // Simple CSV parse
    const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length > 1) {
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      });

      let sheetType: 'variable' | 'benchmark' | 'prompt' | 'unknown' = 'unknown';
      if (isVariableSheet(headers)) sheetType = 'variable';
      else if (isBenchmarkSheet(headers)) sheetType = 'benchmark';
      else if (isPromptMatrixSheet(headers)) sheetType = 'prompt';

      allSheets.push({ name: file.name, headers, rows, sheetType });
    }
  } else {
    return jsonError('Unsupported file format. Use .xlsx, .xls, .xlsm, or .csv', 400);
  }

  if (allSheets.length === 0) {
    return jsonError('No data found in file', 400);
  }

  console.log(`[parse-doc-matrix] Parsed ${allSheets.length} sheets: ${allSheets.map(s => `${s.name}(${s.sheetType})`).join(', ')}`);

  // Step 1: Process variable sheets → enrich identity card (back only)
  const variableSheets = allSheets.filter(s => s.sheetType === 'variable');
  let identityResult = { applied: [] as string[], skipped: [] as string[] };

  for (const vs of variableSheets) {
    const variables = parseVariables(vs.rows, vs.headers);
    if (variables.length > 0) {
      console.log(`[parse-doc-matrix] Found ${variables.length} variables in "${vs.name}" → enriching identity card`);
      const result = await enrichIdentityFromVariables(variables, trackedSiteId, userId);
      identityResult.applied.push(...result.applied);
      identityResult.skipped.push(...result.skipped);
    }
  }

  // Step 2: Process benchmark / prompt sheets
  const benchmarkSheets = allSheets.filter(s => s.sheetType === 'benchmark');
  const promptSheets = allSheets.filter(s => s.sheetType === 'prompt');
  const dataSheets = benchmarkSheets.length > 0 ? benchmarkSheets : promptSheets;

  let benchmarkRows: BenchmarkRow[] = [];
  let isBenchmarkMode = benchmarkSheets.length > 0;
  let detectedEngines: string[] = [];
  let detectedThemes: string[] = [];

  for (const ds of dataSheets) {
    const rows = parseBenchmarkRows(ds.rows, ds.headers);
    benchmarkRows.push(...rows);
  }

  if (isBenchmarkMode) {
    detectedEngines = [...new Set(benchmarkRows.map(r => r.engine).filter(Boolean) as string[])];
    detectedThemes = [...new Set(benchmarkRows.map(r => r.theme).filter(Boolean) as string[])];
  }

  // Generate display schema
  const allHeaders = dataSheets.flatMap(s => s.headers);
  const schemaHash = generateSchemaHash(allHeaders, detectedEngines.length > 0, detectedThemes.length > 0);

  // Build display schema config
  const displaySchema = {
    schema_hash: schemaHash,
    is_benchmark: isBenchmarkMode,
    engines: detectedEngines,
    themes: detectedThemes,
    columns: isBenchmarkMode ? [
      { key: 'theme', label: 'Thème', type: 'text' },
      { key: 'prompt', label: 'Prompt', type: 'text' },
      ...detectedEngines.map(e => ({ key: `engine_${e}`, label: e, type: 'score' })),
    ] : [
      { key: 'prompt', label: 'KPI', type: 'text' },
      { key: 'axe', label: 'Catégorie', type: 'badge' },
      { key: 'poids', label: 'Poids', type: 'number' },
      { key: 'score', label: 'Score', type: 'score' },
    ],
  };

  // Save display schema to DB if user is authenticated
  if (userId) {
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabaseAdmin.from('matrix_display_schemas').upsert({
        user_id: userId,
        schema_hash: schemaHash,
        schema_name: file.name,
        columns_config: displaySchema.columns,
        scoring_config: { is_benchmark: isBenchmarkMode, engines: detectedEngines, themes: detectedThemes },
        source_file_signature: file.name,
        usage_count: 1,
      }, { onConflict: 'user_id,schema_hash' });
    } catch (e) {
      console.error('[parse-doc-matrix] Schema save error:', e);
    }
  }

  // Format rows for frontend
  const outputRows = benchmarkRows.map((r, i) => ({
    id: `row-${i}-${Date.now()}`,
    prompt: r.prompt,
    theme: r.theme || r.axe,
    engine: r.engine,
    poids: r.poids,
    axe: r.axe,
    seuil_bon: r.seuil_bon,
    seuil_moyen: r.seuil_moyen,
    seuil_mauvais: r.seuil_mauvais,
    llm_name: r.llm_name,
  }));

  return jsonOk({
    fileName: file.name,
    rows: outputRows,
    sheets: allSheets.map(s => ({ name: s.name, type: s.sheetType, rowCount: s.rows.length })),
    identity_enrichment: identityResult,
    display_schema: displaySchema,
    is_benchmark: isBenchmarkMode,
    detected_engines: detectedEngines,
    detected_themes: detectedThemes,
  });
}));
