import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileSpreadsheet, Search, Trash2, CheckCircle2, ArrowRight, ArrowLeft, Loader2, CreditCard, BookOpen, BarChart3 } from 'lucide-react';
import { detectMatriceType, type MatriceType, type DetectionResult } from '@/utils/matrice/typeDetector';
import { cleanImportedData, type CleaningResult } from '@/utils/matrice/columnCleaner';
import { sanitizeAllPrompts } from '@/utils/matrice/promptSanitizer';
import { detectScoredWide } from '@/utils/matrice/scoredWideUnpivot';

/* ── Types ─────────────────────────────────────────────────────────── */

type Step = 'type' | 'sheet' | 'clean' | 'confirm';

/** Detected identity card variables from a "Variable" sheet */
export interface IdentityCard {
  variables: Record<string, string>; // e.g. { "[MARQUE]": "Studio GforCréa", "[SITE_MARQUE]": "https://..." }
  brandUrl?: string; // extracted from [SITE_MARQUE] or similar
  brandName?: string; // extracted from [MARQUE] or similar
}

/** Per-engine citation instructions extracted from "Engine notes" sheet */
export interface EngineNote {
  engine: string;
  howToAskCitations: string;
  whyItMatters: string;
  sourceUrl: string;
}

/** Scoring rubric field from "Scoring Guide" sheet */
export interface ScoringField {
  field: string;
  whatToCode: string;
  allowedValues: string;
  meaning: string;
}

/** Metadata extracted from secondary sheets (Engine notes + Scoring Guide) */
export interface MatrixMetadata {
  engineNotes: EngineNote[];
  scoringGuide: ScoringField[];
}

interface Props {
  open: boolean;
  sheetNames: string[];
  workbook: any; // xlsx WorkbookType
  onComplete: (data: {
    rows: Record<string, any>[];
    sheetName: string;
    matriceType: MatriceType;
    cleaningResult: CleaningResult;
    identityCard?: IdentityCard;
    metadata?: MatrixMetadata;
  }) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<MatriceType, { label: string; desc: string; color: string }> = {
  seo: { label: 'SEO', desc: 'Audit technique, balises, performance, structured data', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  geo: { label: 'GEO', desc: 'Citabilité IA, visibilité moteurs génératifs, scoring multi-LLM', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  hybrid: { label: 'Hybride', desc: 'Critères SEO + GEO combinés', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  benchmark: { label: 'Benchmark LLM', desc: 'Test de citation par moteur IA — heatmap thème × engine', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
};

const STEPS_MULTI: { key: Step; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'sheet', label: 'Onglets' },
  { key: 'clean', label: 'Nettoyage' },
  { key: 'confirm', label: 'Import' },
];

const STEPS_SINGLE: { key: Step; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'clean', label: 'Nettoyage' },
  { key: 'confirm', label: 'Import' },
];

/* ── Variable sheet detection ──────────────────────────────────────── */

const VARIABLE_SHEET_PATTERNS = [
  /^variable/i, /^identit[eé]/i, /^carte/i, /^identity/i, /^config/i,
];

const VARIABLE_COLUMN_PATTERNS = [
  /^variable$/i, /^cl[eé]$/i, /^key$/i, /^param[eè]tre$/i,
];

const VALUE_COLUMN_PATTERNS = [
  /^valeur$/i, /^value$/i, /^retenue$/i, /^contenu$/i,
];

function isVariableSheet(sheetName: string, headers: string[]): boolean {
  if (VARIABLE_SHEET_PATTERNS.some(p => p.test(sheetName.trim()))) return true;
  if (headers.length >= 2 && VARIABLE_COLUMN_PATTERNS.some(p => p.test(headers[0]))) return true;
  return false;
}

/* ── Engine Notes / Scoring Guide detection ────────────────────────── */

const ENGINE_NOTES_PATTERNS = [/^engine.?notes?/i, /^notes?.?moteur/i, /^citation.?guide/i];
const SCORING_GUIDE_PATTERNS = [/^scoring.?guide/i, /^grille.?scoring/i, /^scoring$/i, /^codage/i];
const SUMMARY_SHEET_PATTERNS = [
  /synth[èe]se/i,
  /^r[ée]sum[ée]$/i,
  /^summary$/i,
  /^totaux?$/i,
  /^aggreg/i,
  /^bilan$/i,
  /^scores?\s+par\s+(moteur|prompt)/i,
  /^statistiques?$/i,
];

function isEngineNotesSheet(sheetName: string, headers: string[]): boolean {
  if (ENGINE_NOTES_PATTERNS.some(p => p.test(sheetName.trim()))) return true;
  const hJoined = headers.map(h => h.toLowerCase()).join('|');
  return hJoined.includes('how_to_ask') && hJoined.includes('engine');
}

function isScoringGuideSheet(sheetName: string, headers: string[]): boolean {
  if (SCORING_GUIDE_PATTERNS.some(p => p.test(sheetName.trim()))) return true;
  const hJoined = headers.map(h => h.toLowerCase()).join('|');
  return hJoined.includes('what_to_code') && hJoined.includes('allowed_values');
}

function isSummarySheet(sheetName: string, _headers: string[]): boolean {
  return SUMMARY_SHEET_PATTERNS.some(p => p.test(sheetName.trim()));
}

function extractEngineNotes(rows: Record<string, any>[], headers: string[]): EngineNote[] {
  const engineCol = headers.find(h => /^engine$/i.test(h)) || headers[0];
  const howCol = headers.find(h => /how_to_ask/i.test(h)) || headers[1];
  const whyCol = headers.find(h => /why_it_matters/i.test(h)) || headers[2];
  const srcCol = headers.find(h => /source_url/i.test(h)) || headers[3];
  return rows
    .filter(r => String(r[engineCol] ?? '').trim())
    .map(r => ({
      engine: String(r[engineCol] ?? '').trim(),
      howToAskCitations: String(r[howCol] ?? '').trim(),
      whyItMatters: String(r[whyCol] ?? '').trim(),
      sourceUrl: String(r[srcCol] ?? '').trim(),
    }));
}

function extractScoringGuide(rows: Record<string, any>[], headers: string[]): ScoringField[] {
  const fieldCol = headers.find(h => /^field$/i.test(h)) || headers[0];
  const whatCol = headers.find(h => /what_to_code/i.test(h)) || headers[1];
  const valuesCol = headers.find(h => /allowed_values/i.test(h)) || headers[2];
  const meaningCol = headers.find(h => /^meaning$/i.test(h)) || headers[3];
  return rows
    .filter(r => String(r[fieldCol] ?? '').trim())
    .map(r => ({
      field: String(r[fieldCol] ?? '').trim(),
      whatToCode: String(r[whatCol] ?? '').trim(),
      allowedValues: String(r[valuesCol] ?? '').trim(),
      meaning: String(r[meaningCol] ?? '').trim(),
    }));
}

function extractIdentityCard(rows: Record<string, any>[], headers: string[]): IdentityCard {
  const variables: Record<string, string> = {};

  // Find the key column and value column
  const keyCol = headers.find(h => VARIABLE_COLUMN_PATTERNS.some(p => p.test(h))) || headers[0];
  // Prefer "retenue" (validated value), then "valeur" (raw value)
  const valueCol = headers.find(h => /^retenue$/i.test(h))
    || headers.find(h => VALUE_COLUMN_PATTERNS.some(p => p.test(h)))
    || headers[1];

  for (const row of rows) {
    const key = String(row[keyCol] ?? '').trim();
    const val = String(row[valueCol] ?? '').trim();
    if (key && val) {
      variables[key] = val;
    }
  }

  // Extract brand URL and name
  const brandUrl = variables['[SITE_MARQUE]'] || variables['[URL]'] || variables['[SITE]'] || undefined;
  const brandName = variables['[MARQUE]'] || variables['[BRAND]'] || variables['[NOM]'] || undefined;

  return { variables, brandUrl, brandName };
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function ImportStepper({ open, sheetNames, workbook, onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>('type');
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<MatriceType | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [cleaning, setCleaning] = useState<CleaningResult | null>(null);
  const [identityCard, setIdentityCard] = useState<IdentityCard | null>(null);
  const [detectedVariableSheets, setDetectedVariableSheets] = useState<string[]>([]);
  const [detectedMetaSheets, setDetectedMetaSheets] = useState<Record<string, 'engine_notes' | 'scoring_guide'>>({});
  const [detectedSummarySheets, setDetectedSummarySheets] = useState<string[]>([]);
  const [matrixMetadata, setMatrixMetadata] = useState<MatrixMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  const hasMultipleSheets = sheetNames.length > 1;
  const steps = hasMultipleSheets ? STEPS_MULTI : STEPS_SINGLE;

  // ── Auto-detect variable + metadata + summary sheets on open ────────
  // Pré-coche également les onglets "data" pertinents (ni variable, ni méta,
  // ni résumé) afin que l'utilisateur n'importe pas de doublons (ex: Synthèse,
  // Scores par prompt) qui dégradent la heatmap.
  useEffect(() => {
    if (!open || !workbook || sheetNames.length === 0) return;
    const detectSpecialSheets = async () => {
      const { utils } = await import('xlsx');
      const varSheets: string[] = [];
      const metaSheets: Record<string, 'engine_notes' | 'scoring_guide'> = {};
      const summarySheets: string[] = [];
      const dataSheets: string[] = [];
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const rows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (rows.length === 0) continue;
        const h = Object.keys(rows[0]);
        if (isVariableSheet(name, h)) {
          varSheets.push(name);
        } else if (isEngineNotesSheet(name, h)) {
          metaSheets[name] = 'engine_notes';
        } else if (isScoringGuideSheet(name, h)) {
          metaSheets[name] = 'scoring_guide';
        } else if (isSummarySheet(name, h)) {
          summarySheets.push(name);
        } else {
          dataSheets.push(name);
        }
      }
      setDetectedVariableSheets(varSheets);
      setDetectedMetaSheets(metaSheets);
      setDetectedSummarySheets(summarySheets);
      // Pré-coche uniquement les onglets data détectés. Si aucun n'a été
      // identifié comme tel, on retombe sur la sélection vide (l'utilisateur
      // choisit manuellement).
      if (dataSheets.length > 0) {
        setSelectedSheets(dataSheets);
        console.log(`[ImportStepper] Auto-sélection de ${dataSheets.length} onglet(s) data:`, dataSheets, '— écartés:', { variables: varSheets, meta: Object.keys(metaSheets), résumés: summarySheets });
      }
    };
    detectSpecialSheets();
  }, [open, workbook, sheetNames]);

  // ── Toggle a sheet in multi-select ──────────────────────────────────
  const toggleSheet = (name: string) => {
    setSelectedSheets(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  // ── Parse selected sheets: separate Variable sheets from data sheets ─
  const parseSheetsAndClean = useCallback(async (sheets: string[]) => {
    if (!workbook || !selectedType || sheets.length === 0) return;
    setLoading(true);
    try {
      const { utils } = await import('xlsx');
      let dataRows: Record<string, any>[] = [];
      let card: IdentityCard | null = null;
      let engineNotes: EngineNote[] = [];
      let scoringGuide: ScoringField[] = [];
      const dataSheetNames: string[] = [];

      for (const sheetName of sheets) {
        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (rows.length === 0) {
          console.warn('[ImportStepper] Empty sheet:', sheetName);
          continue;
        }

        const h = Object.keys(rows[0]);

        // Check if this is a Variable/Identity sheet
        if (isVariableSheet(sheetName, h)) {
          console.log(`[ImportStepper] Variable sheet detected: "${sheetName}" (${rows.length} vars)`);
          card = extractIdentityCard(rows, h);
          continue;
        }

        // Check Engine Notes sheet
        if (isEngineNotesSheet(sheetName, h)) {
          engineNotes = extractEngineNotes(rows, h);
          console.log(`[ImportStepper] Engine notes extracted: ${engineNotes.length} engines (${engineNotes.map(e => e.engine).join(', ')})`);
          continue;
        }

        // Check Scoring Guide sheet
        if (isScoringGuideSheet(sheetName, h)) {
          scoringGuide = extractScoringGuide(rows, h);
          console.log(`[ImportStepper] Scoring guide extracted: ${scoringGuide.length} fields (${scoringGuide.map(f => f.field).join(', ')})`);
          continue;
        }

        console.log(`[ImportStepper] Data sheet "${sheetName}": ${rows.length} rows, ${h.length} cols`);
        dataSheetNames.push(sheetName);
        // ── Tag each row with its source sheet name as `axe` (= Z-axis of the cube) ──
        // Preserves the multi-tab structure (Comparatif / Local / Transactionnel / Informationnel)
        // so the backend renders distinct families. Use `||` (not `??`) so empty strings ALSO
        // fall back to the sheet name (a column may exist but be blank for many rows).
        const taggedRows = rows.map(r => {
          const explicitAxe = String(r.axe ?? r.Axe ?? r.AXE ?? r.famille ?? r.Famille ?? '').trim();
          return {
            ...r,
            axe: explicitAxe || sheetName,
            _source_sheet: sheetName,
          };
        });
        dataRows = dataRows.concat(taggedRows);
      }

      // Also parse non-selected meta sheets automatically (they enrich, not data)
      for (const [metaName, metaType] of Object.entries(detectedMetaSheets)) {
        if (sheets.includes(metaName)) continue; // already processed
        const sheet = workbook.Sheets[metaName];
        const rows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (rows.length === 0) continue;
        const h = Object.keys(rows[0]);
        if (metaType === 'engine_notes' && engineNotes.length === 0) {
          engineNotes = extractEngineNotes(rows, h);
          console.log(`[ImportStepper] Auto-extracted engine notes from "${metaName}": ${engineNotes.length} engines`);
        } else if (metaType === 'scoring_guide' && scoringGuide.length === 0) {
          scoringGuide = extractScoringGuide(rows, h);
          console.log(`[ImportStepper] Auto-extracted scoring guide from "${metaName}": ${scoringGuide.length} fields`);
        }
      }

      setIdentityCard(card);
      const meta: MatrixMetadata = { engineNotes, scoringGuide };
      setMatrixMetadata(meta.engineNotes.length > 0 || meta.scoringGuide.length > 0 ? meta : null);

      if (!dataRows.length) {
        // If only variable sheets were selected, warn user
        if (card) {
          console.warn('[ImportStepper] Only variable sheets selected, no prompt data');
        }
        setLoading(false);
        return;
      }

      // ── Union ALL headers from all data rows ────────────────────────
      const headerSet = new Set<string>();
      for (const row of dataRows) {
        for (const key of Object.keys(row)) {
          headerSet.add(key);
        }
      }
      const h = Array.from(headerSet);
      setHeaders(h);
      setRawRows(dataRows);

      const det = detectMatriceType(h, dataRows.slice(0, 10));
      setDetection(det);
      console.log(`[ImportStepper] Merged: ${dataRows.length} rows from ${dataSheetNames.length} data sheet(s), headers: ${h.length}, detected=${det.type} (${Math.round(det.confidence * 100)}%)`);
      if (card) {
        console.log(`[ImportStepper] Identity card: ${Object.keys(card.variables).length} vars, brand="${card.brandName}", url="${card.brandUrl}"`);
      }

      // ── Bypass cleaning if file is a "scored-wide" benchmark ────────
      // (sinon les colonnes _Score_Citabilite / _Mentionne / _Cite seraient supprimées
      //  et la heatmap n'aurait plus de quoi se nourrir).
      const wideDet = detectScoredWide(h);
      let result: CleaningResult;
      if (wideDet.detected) {
        console.log('[ImportStepper] Scored-wide détecté → bypass cleaning :', wideDet.reason);
        result = {
          cleanedRows: dataRows,
          removedColumns: [],
          keptColumns: h,
          stats: { originalColumns: h.length, removedColumns: 0, keptColumns: h.length, originalRows: dataRows.length, cleanedRows: dataRows.length },
        };
      } else {
        result = cleanImportedData(h, dataRows);
      }

      // Sanitize prompts: replace hardcoded URLs/brand names with placeholders
      result.cleanedRows = sanitizeAllPrompts(result.cleanedRows, card ?? undefined);
      console.log('[ImportStepper] Prompts sanitized — hardcoded URLs/brands replaced with placeholders');

      setCleaning(result);
      setStep('clean');
    } catch (err) {
      console.error('[ImportStepper] Sheet parse error:', err);
    } finally {
      setLoading(false);
    }
  }, [workbook, selectedType]);

  // Reset state when modal opens
  useEffect(() => {
    if (open && sheetNames.length > 0 && workbook) {
      setStep('type');
      setSelectedSheets([]);
      setSelectedType(null);
      setHeaders([]);
      setRawRows([]);
      setDetection(null);
      setCleaning(null);
      setIdentityCard(null);
      setMatrixMetadata(null);
      setLoading(false);
    }
  }, [open, sheetNames, workbook]);

  const currentStepIndex = steps.findIndex(s => s.key === step);

  // ── Type confirmed → go to sheet or parse directly ─────────────────
  const handleTypeConfirm = () => {
    if (!selectedType) return;
    if (hasMultipleSheets) {
      setStep('sheet');
    } else {
      setSelectedSheets([sheetNames[0]]);
      parseSheetsAndClean([sheetNames[0]]);
    }
  };

  // ── Sheets confirmed → parse and merge ─────────────────────────────
  const handleSheetsConfirm = () => {
    if (selectedSheets.length === 0) return;
    parseSheetsAndClean(selectedSheets);
  };

  // ── Final import ───────────────────────────────────────────────────
  const handleImport = () => {
    if (!cleaning || !selectedType) return;
    onComplete({
      rows: cleaning.cleanedRows,
      sheetName: selectedSheets.join(' + '),
      matriceType: selectedType,
      cleaningResult: cleaning,
      identityCard: identityCard || undefined,
      metadata: matrixMetadata || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Matrice</DialogTitle>
        </DialogHeader>

        {/* ── Stepper bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => {
            const isActive = s.key === step;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors w-full justify-center
                  ${isActive ? 'bg-primary/10 text-primary border border-primary/30' : ''}
                  ${isDone ? 'text-muted-foreground' : ''}
                  ${!isActive && !isDone ? 'text-muted-foreground/50' : ''}
                `}>
                  {isDone && <CheckCircle2 className="h-3 w-3" />}
                  {s.label}
                </div>
                {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ── Loading state ────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Parsing du fichier…</span>
          </div>
        )}

        {/* ── Step: Type (FIRST) ───────────────────────────────────── */}
        {!loading && step === 'type' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Quel type d'audit souhaitez-vous réaliser ?
            </p>

            <div className="flex flex-col gap-2">
              {(Object.keys(TYPE_LABELS) as MatriceType[]).map(t => {
                const info = TYPE_LABELS[t];
                const isSelected = selectedType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                      ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                    `}
                  >
                    <div className="flex-1">
                      <span className="font-medium text-sm">{info.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`} />
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleTypeConfirm} disabled={!selectedType}>
                Continuer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Sheet (multi-select with checkboxes) ───────────── */}
        {!loading && step === 'sheet' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground mb-1">
              Ce fichier contient {sheetNames.length} onglets. Lesquels importer ?
            </p>
            {sheetNames.map(name => {
              const isChecked = selectedSheets.includes(name);
              const isVar = detectedVariableSheets.includes(name);
              const metaType = detectedMetaSheets[name];
              const isMetaSheet = !!metaType;
              const isSummary = detectedSummarySheets.includes(name);
              const sheetIcon = isVar ? <CreditCard className="h-4 w-4 shrink-0 text-amber-500" />
                : metaType === 'engine_notes' ? <BookOpen className="h-4 w-4 shrink-0 text-cyan-500" />
                : metaType === 'scoring_guide' ? <BarChart3 className="h-4 w-4 shrink-0 text-emerald-500" />
                : isSummary ? <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                : <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />;
              const badgeLabel = isVar ? "Carte d'identité"
                : metaType === 'engine_notes' ? 'Instructions moteur'
                : metaType === 'scoring_guide' ? 'Grille scoring'
                : isSummary ? 'Résumé (doublon)'
                : null;
              const badgeColor = isVar ? 'border-amber-500/30 text-amber-500'
                : metaType === 'engine_notes' ? 'border-cyan-500/30 text-cyan-500'
                : metaType === 'scoring_guide' ? 'border-emerald-500/30 text-emerald-500'
                : isSummary ? 'border-muted-foreground/30 text-muted-foreground'
                : '';
              return (
                <button
                  key={name}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                    ${isChecked ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                  `}
                  onClick={() => toggleSheet(name)}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleSheet(name)}
                    className="shrink-0"
                  />
                  {sheetIcon}
                  <span className="truncate text-sm">{name}</span>
                  {badgeLabel && (
                    <Badge variant="outline" className={`ml-auto text-[10px] ${badgeColor}`}>
                      {badgeLabel}
                    </Badge>
                  )}
                  {(isMetaSheet || isSummary) && !isChecked && (
                    <span className="text-[9px] text-muted-foreground/60">auto</span>
                  )}
                </button>
              );
            })}
            <div className="flex justify-between mt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Type
              </Button>
              <Button size="sm" onClick={handleSheetsConfirm} disabled={selectedSheets.length === 0}>
                Continuer ({selectedSheets.length}) <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Clean ──────────────────────────────────────────── */}
        {!loading && step === 'clean' && cleaning && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Nettoyage effectué sur {selectedSheets.length} onglet{selectedSheets.length > 1 ? 's' : ''}. Les colonnes de résultats et données résiduelles ont été retirées.
            </p>

            {/* Identity card detected */}
            {identityCard && (
              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Carte d'identité détectée — {Object.keys(identityCard.variables).length} variables
                  </span>
                </div>
                {identityCard.brandName && (
                  <span className="text-muted-foreground">Marque : <strong className="text-foreground">{identityCard.brandName}</strong></span>
                )}
                {identityCard.brandUrl && (
                  <span className="text-muted-foreground ml-2">URL : <strong className="text-foreground">{identityCard.brandUrl}</strong></span>
                )}
              </div>
            )}

            {/* Matrix metadata detected */}
            {matrixMetadata && (
              <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs space-y-1">
                {matrixMetadata.engineNotes.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-cyan-500" />
                    <span className="text-muted-foreground">
                      Instructions moteur : <strong className="text-foreground">{matrixMetadata.engineNotes.map(e => e.engine).join(', ')}</strong>
                      <span className="text-muted-foreground/60 ml-1">— enrichira chaque prompt selon son engine</span>
                    </span>
                  </div>
                )}
                {matrixMetadata.scoringGuide.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Grille de scoring : <strong className="text-foreground">{matrixMetadata.scoringGuide.length} critères</strong>
                      <span className="text-muted-foreground/60 ml-1">— servira de rubrique d'évaluation</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {detection && selectedType && detection.type !== selectedType && detection.confidence >= 0.6 && (
              <p className="text-xs text-amber-400">
                ⚠ Les colonnes suggèrent plutôt « {TYPE_LABELS[detection.type].label} » ({Math.round(detection.confidence * 100)}% confiance).
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-2xl font-bold text-foreground">{cleaning.stats.keptColumns}</div>
                <div className="text-xs text-muted-foreground">colonnes conservées</div>
              </div>
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="text-2xl font-bold text-destructive">{cleaning.stats.removedColumns}</div>
                <div className="text-xs text-muted-foreground">colonnes retirées</div>
              </div>
            </div>

            {cleaning.removedColumns.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs space-y-1 bg-muted/30 rounded-md p-2">
                {cleaning.removedColumns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3 text-destructive/60 shrink-0" />
                    <span className="text-muted-foreground truncate">{col.header}</span>
                    <span className="text-muted-foreground/50 ml-auto shrink-0">({col.reason})</span>
                  </div>
                ))}
              </div>
            )}

            {cleaning.keptColumns.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <strong>Colonnes gardées :</strong> {cleaning.keptColumns.join(', ')}
              </div>
            )}

            <div className="flex justify-between mt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(hasMultipleSheets ? 'sheet' : 'type')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {hasMultipleSheets ? 'Onglets' : 'Type'}
              </Button>
              <Button size="sm" onClick={() => setStep('confirm')}>
                Continuer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Confirm ────────────────────────────────────────── */}
        {!loading && step === 'confirm' && cleaning && selectedType && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Prêt à importer. Récapitulatif :
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className={TYPE_LABELS[selectedType].color}>
                  {TYPE_LABELS[selectedType].label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Onglet{selectedSheets.length > 1 ? 's' : ''}</span>
                <span className="font-medium text-right max-w-[200px] truncate">{selectedSheets.join(' + ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Critères</span>
                <span className="font-medium">{cleaning.stats.cleanedRows} lignes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Colonnes</span>
                <span className="font-medium">{cleaning.stats.keptColumns} / {cleaning.stats.originalColumns}</span>
              </div>
              {identityCard && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Carte d'identité</span>
                  <span className="font-medium text-amber-500">{Object.keys(identityCard.variables).length} variables</span>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('clean')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Nettoyage
              </Button>
              <Button size="sm" onClick={handleImport}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Importer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
