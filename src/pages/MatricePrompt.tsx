import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Upload, Search, Loader2, ArrowLeft, FileText, FileSpreadsheet, Trash2, FileDown, AlertTriangle, Pencil, Check, X as XIcon, HelpCircle, History, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
// Select removed — batches now shown as cards
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Header } from '@/components/Header';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { mapColumns, transformRows } from '@/utils/matrice/fuzzyColumnMapper';
import { MatriceHelpModal } from '@/components/Matrice/MatriceHelpModal';
import ImportStepper, { type MatrixMetadata } from '@/components/Matrice/ImportStepper';
import BenchmarkHeatmap from '@/components/Matrice/BenchmarkHeatmap';
import type { MatriceType } from '@/utils/matrice/typeDetector';
import { getSmartDefaults } from '@/utils/matrice/smartDefaults';
import { type ScoringMethodId, type ScoringMethod, getScoringConfig, detectScoringMethod, detectScoringSheet, SCORING_REGISTRY } from '@/utils/matrice/scoringDetector';
import { MatriceProgressTracker, MatriceErrorCard } from '@/components/Matrice';
import { useMatriceProgress } from '@/hooks/useMatriceProgress';
import { seedsForStandardAudit, seedsForBenchmark, makePending, makeRunning, makeDone, makeError } from '@/utils/matrice/matriceCallEvents';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';
import { useMatriceAudits } from '@/hooks/useMatriceAudits';
import { buildPivot } from '@/utils/matrice/pivotTransform';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MatrixRow {
  id: string;
  dbId?: string; // prompt_matrix_items UUID
  prompt: string;
  poids: number;
  axe: string;
  theme?: string;
  engine?: string;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name: string;
  selected: boolean;
  isDefault: Record<string, boolean>;
}

// Static fallback defaults (overridden by smart defaults when matrice type is known)
const DEFAULTS = {
  poids: 1,
  axe: 'Général',
  seuil_bon: 70,
  seuil_moyen: 40,
  seuil_mauvais: 0,
  llm_name: 'google/gemini-2.5-flash',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MatricePrompt() {
  const navigate = useNavigate();
  useCanonicalHreflang('/app/matrice-prompt');
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const { isDemoMode } = useDemoMode();

  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<{ results: any[]; themes: string[]; engines: string[]; heatmap: any; globalScore: number; citationRate: number } | null>(null);
  // Dynamic column labels from fuzzy mapping (original header → mapped field)
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch management
  interface Batch { batch_id: string; batch_label: string; created_at: string; count: number; last_used_at: string; }
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [renamingBatchId, setRenamingBatchId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [submittingError, setSubmittingError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeMetadata, setActiveMetadata] = useState<MatrixMetadata | null>(null);

  // Real-time progress tracker (Sprint 4 wiring)
  const progress = useMatriceProgress();

  // Sprint 7 — Persistence layer for matrix_audits + resume.
  const { saveAudit } = useMatriceAudits();
  const auditStartRef = useRef<number | null>(null);
  const [resumeBanner, setResumeBanner] = useState<{ count: number; total: number } | null>(null);

  const LAST_BATCH_KEY = 'matrice_last_batch_id';
  const PARTIAL_KEY = 'rapport_matrice_results_partial';

  const handleReportError = async () => {
    if (!errorTitle.trim() || !user) return;
    setSubmittingError(true);
    const { error } = await supabase.from('matrix_errors').insert({
      user_id: user.id,
      user_email: user.email || null,
      error_type: 'user_report',
      title: errorTitle.trim(),
      description: errorDesc.trim() || null,
      batch_id: activeBatchId || null,
      context_data: { url, kpi_count: rows.length, selected_count: rows.filter(r => r.selected).length, has_results: !!results },
    });
    setSubmittingError(false);
    if (error) { toast.error('Erreur lors du signalement'); return; }
    toast.success('Erreur signalée — merci !');
    setShowErrorDialog(false);
    setErrorTitle('');
    setErrorDesc('');
  };

  // No auth guard — /matrice is publicly accessible

  // Load available batches on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('prompt_matrix_items')
        .select('batch_id, batch_label, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !data) { setLoadingBatches(false); return; }

      // Group by batch_id
      const map = new Map<string, Batch>();
      data.forEach((row: any) => {
        if (!map.has(row.batch_id)) {
          map.set(row.batch_id, { batch_id: row.batch_id, batch_label: row.batch_label, created_at: row.created_at, count: 0, last_used_at: row.created_at });
        }
        map.get(row.batch_id)!.count++;
      });
      const list = Array.from(map.values());
      setBatches(list);

      // Pre-select last used or most recent
      const lastUsed = localStorage.getItem(LAST_BATCH_KEY);
      const target = list.find(b => b.batch_id === lastUsed) || list[0];
      if (target) {
        setActiveBatchId(target.batch_id);
        await loadBatch(target.batch_id);
      }
      setLoadingBatches(false);
    })();
  }, [user]);

  // Demo mode: inject simulated data for screenshots
  useEffect(() => {
    if (!isDemoMode || rows.length > 0) return;
    const demoRows: MatrixRow[] = [
      { id: 'd-1', prompt: 'Balise Title optimisée (longueur, mot-clé principal)', poids: 3, axe: 'SEO', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-2', prompt: 'Meta Description unique et incitative', poids: 2, axe: 'SEO', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-3', prompt: 'Données structurées Schema.org (JSON-LD)', poids: 3, axe: 'Données structurées', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-4', prompt: 'Score E-E-A-T (Expertise, Expérience, Autorité, Fiabilité)', poids: 4, axe: 'E-E-A-T', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-5', prompt: 'Qualité du contenu (profondeur, pertinence, originalité)', poids: 4, axe: 'Contenu', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-6', prompt: 'Temps de chargement (LCP < 2.5s)', poids: 2, axe: 'Performance', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-7', prompt: 'Certificat SSL / HTTPS', poids: 1, axe: 'Sécurité', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-8', prompt: 'Robots.txt et directives d\'indexation', poids: 2, axe: 'Technique', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-9', prompt: 'Accessibilité des images (alt text)', poids: 2, axe: 'SEO', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-10', prompt: 'Maillage interne (liens contextuels pertinents)', poids: 3, axe: 'Maillage', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
      { id: 'd-11', prompt: 'Visibilité LLM — citation par ChatGPT / Perplexity', poids: 4, axe: 'GEO', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: 'openai/gpt-5', selected: true, isDefault: {} },
      { id: 'd-12', prompt: 'UX Mobile (responsive, touch targets)', poids: 2, axe: 'UX', seuil_bon: 70, seuil_moyen: 40, seuil_mauvais: 0, llm_name: '', selected: true, isDefault: {} },
    ];
    const demoResults = [
      { id: 'd-1', prompt: demoRows[0].prompt, poids: 3, detected_type: 'meta-tags', parsed_score: 85, crawlers_score: 85 },
      { id: 'd-2', prompt: demoRows[1].prompt, poids: 2, detected_type: 'meta-tags', parsed_score: 72, crawlers_score: 78 },
      { id: 'd-3', prompt: demoRows[2].prompt, poids: 3, detected_type: 'structured-data', parsed_score: 90, crawlers_score: 92 },
      { id: 'd-4', prompt: demoRows[3].prompt, poids: 4, detected_type: 'eeat', parsed_score: 65, crawlers_score: 71 },
      { id: 'd-5', prompt: demoRows[4].prompt, poids: 4, detected_type: 'content-quality', parsed_score: 78, crawlers_score: 82 },
      { id: 'd-6', prompt: demoRows[5].prompt, poids: 2, detected_type: 'pagespeed', parsed_score: 55, crawlers_score: 60 },
      { id: 'd-7', prompt: demoRows[6].prompt, poids: 1, detected_type: 'robots', parsed_score: 100, crawlers_score: 100 },
      { id: 'd-8', prompt: demoRows[7].prompt, poids: 2, detected_type: 'robots', parsed_score: 88, crawlers_score: 88 },
      { id: 'd-9', prompt: demoRows[8].prompt, poids: 2, detected_type: 'images', parsed_score: 45, crawlers_score: 52 },
      { id: 'd-10', prompt: demoRows[9].prompt, poids: 3, detected_type: 'cocoon', parsed_score: 62, crawlers_score: 68 },
      { id: 'd-11', prompt: demoRows[10].prompt, poids: 4, detected_type: 'check-llm', parsed_score: 35, crawlers_score: 42 },
      { id: 'd-12', prompt: demoRows[11].prompt, poids: 2, detected_type: 'pagespeed', parsed_score: 70, crawlers_score: 74 },
    ];
    setRows(demoRows);
    setResults(demoResults);
    setUrl('https://example.com');
  }, [isDemoMode, rows.length]);

  // Load a specific batch's prompts + any persisted results
  const loadBatch = async (batchId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('prompt_matrix_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error || !data) return;

    const parsed: MatrixRow[] = data.map((row: any, i: number) => ({
      id: `row-${i}-${row.id}`,
      dbId: row.id,
      prompt: row.prompt,
      poids: Number(row.poids),
      axe: row.axe,
      seuil_bon: Number(row.seuil_bon),
      seuil_moyen: Number(row.seuil_moyen),
      seuil_mauvais: Number(row.seuil_mauvais),
      llm_name: row.llm_name,
      selected: true,
      isDefault: (row.is_default_flags as Record<string, boolean>) || {},
    }));
    setRows(parsed);

    // Try to load persisted results for this batch's prompt items
    const dbIds = parsed.map(p => p.dbId).filter(Boolean) as string[];
    if (dbIds.length > 0) {
      const { data: savedResults } = await supabase
        .from('matrix_audit_results')
        .select('*')
        .eq('user_id', user.id)
        .in('prompt_item_id', dbIds)
        .order('created_at', { ascending: false });

      if (savedResults && savedResults.length > 0) {
        // Group by session_id and take the most recent session
        const sessionIds = [...new Set(savedResults.map((r: any) => r.session_id))];
        const latestSessionId = sessionIds[0]; // already ordered desc
        const latestResults = savedResults.filter((r: any) => r.session_id === latestSessionId);

        // Map back to the format expected by the UI
        const restoredResults = latestResults.map((r: any) => {
          const matchedRow = parsed.find(p => p.dbId === r.prompt_item_id);
          return {
            id: matchedRow?.id || r.prompt_item_id,
            prompt: r.prompt,
            axe: r.axe,
            poids: r.poids,
            crawlers_score: r.crawlers_score ?? r.csv_weighted_score,
            parsed_score: r.csv_weighted_score ?? r.crawlers_score,
            detected_type: (r.raw_data as any)?.detected_type || null,
            raw_data: r.raw_data || {},
            seuil_bon: r.seuil_bon,
            seuil_moyen: r.seuil_moyen,
            seuil_mauvais: r.seuil_mauvais,
            dbId: r.prompt_item_id,
          };
        });

        if (restoredResults.length > 0) {
          setResults(restoredResults);
          // Also restore the URL from the session
          const { data: sessionData } = await supabase
            .from('matrix_audit_sessions')
            .select('url')
            .eq('id', latestSessionId)
            .single();
          if (sessionData?.url) setUrl(sessionData.url);
        } else {
          setResults(null);
        }
      } else {
        setResults(null);
      }
    } else {
      setResults(null);
    }

    localStorage.setItem(LAST_BATCH_KEY, batchId);
  };

  // Switch batch
  const handleBatchChange = async (batchId: string) => {
    setActiveBatchId(batchId);
    // Move to top (last used)
    setBatches(prev => {
      const updated = prev.map(b => b.batch_id === batchId ? { ...b, last_used_at: new Date().toISOString() } : b);
      return updated.sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
    });
    await loadBatch(batchId);
  };

  // Rename batch
  const handleRenameBatch = async (batchId: string, newLabel: string) => {
    if (!newLabel.trim() || !user) return;
    const { error } = await supabase
      .from('prompt_matrix_items')
      .update({ batch_label: newLabel.trim() })
      .eq('user_id', user.id)
      .eq('batch_id', batchId);
    if (error) { toast.error('Erreur lors du renommage'); return; }
    setBatches(prev => prev.map(b => b.batch_id === batchId ? { ...b, batch_label: newLabel.trim() } : b));
    setRenamingBatchId(null);
    toast.success('Prompt renommé');
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('prompt_matrix_items')
      .delete()
      .eq('user_id', user.id)
      .eq('batch_id', batchId);
    if (error) { toast.error('Erreur lors de la suppression'); return; }
    setBatches(prev => prev.filter(b => b.batch_id !== batchId));
    if (activeBatchId === batchId) {
      setActiveBatchId(null);
      setRows([]);
      setResults(null);
    }
    toast.success('Prompt supprimé');
  };

  /* --- Parse raw rows into MatrixRow[] using fuzzy column mapper and persist --- */
  const processImportedRows = useCallback(async (rawRows: any[], fileName: string, matriceType?: MatriceType, scoringMethod?: ScoringMethodId) => {
    if (rawRows.length === 0) return;

    // Use smart defaults based on detected matrice type and scoring method passed at call-site (avoids stale closure)
    const smartDef = matriceType ? getSmartDefaults(matriceType, scoringMethod) : getSmartDefaults('seo');

    // Step 1: Fuzzy column mapping
    const headers = Object.keys(rawRows[0] || {});
    const sampleRows = rawRows.slice(0, Math.min(10, rawRows.length));
    const mappingResult = mapColumns(headers, sampleRows);

    // Show mapping warnings to user
    if (mappingResult.warnings.length > 0) {
      toast.info(`Mapping auto : ${mappingResult.warnings.join(' • ')}`, { duration: 6000 });
    }
    if (mappingResult.unmapped.length > 0) {
      toast.info(`Colonnes ignorées : ${mappingResult.unmapped.join(', ')}`, { duration: 4000 });
    }

    // Store reverse mapping: field → original column header for dynamic labels
    const labels: Record<string, string> = {};
    for (const [header, mapping] of Object.entries(mappingResult.mappings)) {
      labels[mapping.field] = header;
    }
    setColumnLabels(labels);
    // Step 2: Transform rows using the mapping
    const transformedRows = transformRows(rawRows, mappingResult);

    const newBatchId = crypto.randomUUID();
    const parsed: MatrixRow[] = transformedRows.map((raw: any, i: number) => {
      const isDefault: Record<string, boolean> = {};
      const val = (key: string, def: any) => {
        const v = raw[key];
        if (v === undefined || v === null || v === '') {
          isDefault[key] = true;
          return def;
        }
        isDefault[key] = false;
        return typeof def === 'number' ? Number(v) : String(v);
      };
      return {
        id: `row-${i}-${Date.now()}`,
        prompt: val('prompt', `KPI #${i + 1}`),
        poids: val('poids', smartDef.poids),
        axe: val('axe', smartDef.axe),
        theme: val('theme', ''),
        engine: val('engine', ''),
        seuil_bon: val('seuil_bon', smartDef.seuil_bon),
        seuil_moyen: val('seuil_moyen', smartDef.seuil_moyen),
        seuil_mauvais: val('seuil_mauvais', smartDef.seuil_mauvais),
        llm_name: val('llm_name', smartDef.llm_name),
        selected: true,
        isDefault,
      };
    });

    // Persist to DB only if logged in
    if (user) {
      const dbRows = parsed.map(p => ({
        user_id: user.id,
        batch_id: newBatchId,
        batch_label: fileName,
        prompt: p.prompt,
        poids: p.poids,
        axe: p.axe,
        seuil_bon: p.seuil_bon,
        seuil_moyen: p.seuil_moyen,
        seuil_mauvais: p.seuil_mauvais,
        llm_name: p.llm_name,
        is_default_flags: p.isDefault,
      }));

      const { data: inserted, error } = await supabase
        .from('prompt_matrix_items')
        .insert(dbRows)
        .select('id');

      if (!error && inserted) {
        parsed.forEach((p, i) => { p.dbId = inserted[i]?.id; });
      }
    }

    const newBatch: Batch = { batch_id: newBatchId, batch_label: fileName, created_at: new Date().toISOString(), count: parsed.length, last_used_at: new Date().toISOString() };
    setBatches(prev => [newBatch, ...prev]);
    setActiveBatchId(newBatchId);
    localStorage.setItem(LAST_BATCH_KEY, newBatchId);

    setRows(parsed);
    setResults(null);
    toast.success(`${parsed.length} KPIs importés — "${fileName}"`);
  }, [user]);

  /* --- File Import (CSV + XLSX + DOC/DOCX) --- */
  const [docParsing, setDocParsing] = useState(false);
  const [xlsxStepperOpen, setXlsxStepperOpen] = useState(false);
  const [xlsxStepperSheets, setXlsxStepperSheets] = useState<string[]>([]);
  const [xlsxWorkbookRef, setXlsxWorkbookRef] = useState<any>(null);
  const [xlsxFileName, setXlsxFileName] = useState('');
  const [activeMatriceType, setActiveMatriceType] = useState<MatriceType>('seo');
  const [activeScoringMethod, setActiveScoringMethod] = useState<ScoringMethodId>('score_100');
  const activeScoring = useMemo(() => getScoringConfig(activeScoringMethod), [activeScoringMethod]);
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const fileName = file.name.replace(/\.csv$/i, '');
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result) => {
          const csvRows = result.data as Record<string, any>[];
          if (csvRows.length === 0) { toast.error('Fichier CSV vide'); return; }
          // Run type detection + scoring detection on CSV data
          const { detectMatriceType } = await import('@/utils/matrice/typeDetector');
          const { cleanImportedData } = await import('@/utils/matrice/columnCleaner');
          const { sanitizeAllPrompts } = await import('@/utils/matrice/promptSanitizer');
          const { detectScoringMethod: detectScoring } = await import('@/utils/matrice/scoringDetector');
          const csvHeaders = Object.keys(csvRows[0]);
          const det = detectMatriceType(csvHeaders, csvRows.slice(0, 10));
          setActiveMatriceType(det.type);
          const scoringDet = detectScoring(csvHeaders, csvRows.slice(0, 10), det.type);
          setActiveScoringMethod(scoringDet.method);
          if (scoringDet.source !== 'default') {
            toast.info(`Scoring détecté : ${getScoringConfig(scoringDet.method).label}`, { duration: 3000 });
          }
          // Clean + sanitize
          const cleaned = cleanImportedData(csvHeaders, csvRows);
          cleaned.cleanedRows = sanitizeAllPrompts(cleaned.cleanedRows);
          await processImportedRows(cleaned.cleanedRows, fileName, det.type, scoringDet.method);
        },
        error: () => toast.error('Erreur de parsing CSV'),
      });
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
      const fileName = file.name.replace(/\.(xlsx|xls|xlsm)$/i, '');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const { read } = await import('xlsx');
          const workbook = read(evt.target?.result, { type: 'array' });
          setXlsxWorkbookRef(workbook);
          setXlsxFileName(fileName);
          setXlsxStepperSheets(workbook.SheetNames);
          setXlsxStepperOpen(true);
        } catch {
          toast.error('Erreur de parsing XLSX');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'doc' || ext === 'docx') {
      // Send to edge function for AI extraction
      setDocParsing(true);
      const formData = new FormData();
      formData.append('file', file);
      supabase.functions.invoke('parse-doc-matrix', {
        body: formData,
      }).then(async ({ data, error }) => {
        setDocParsing(false);
        if (error || !data?.rows?.length) {
          toast.error(error?.message || 'Aucune donnée exploitable trouvée dans le document');
          return;
        }
        const fileName = file.name.replace(/\.(doc|docx)$/i, '');
        // Run type + scoring detection on DOCX extracted rows
        const { detectMatriceType } = await import('@/utils/matrice/typeDetector');
        const { detectScoringMethod: detectScoring } = await import('@/utils/matrice/scoringDetector');
        const docHeaders = Object.keys(data.rows[0] || {});
        const det = detectMatriceType(docHeaders, data.rows.slice(0, 10));
        setActiveMatriceType(det.type);
        const scoringDet = detectScoring(docHeaders, data.rows.slice(0, 10), det.type);
        setActiveScoringMethod(scoringDet.method);
        processImportedRows(data.rows, fileName, det.type, scoringDet.method);
      }).catch(() => {
        setDocParsing(false);
        toast.error('Erreur lors du parsing du document');
      });
    } else {
      toast.error('Format non supporté. Utilisez .csv, .xlsx, .doc ou .docx');
    }
    e.target.value = '';
  }, [user, processImportedRows]);

  /* --- Sorting --- */
  type SortField = 'prompt' | 'axe' | 'poids' | 'seuil_bon' | 'seuil_moyen' | 'seuil_mauvais';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'fr') : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  /* --- Smart labels based on matrice type + scoring method --- */
  const smartLabels = useMemo(() => getSmartDefaults(activeMatriceType, activeScoringMethod).labels, [activeMatriceType, activeScoringMethod]);

  /* --- Detect if file provided scoring columns (poids/seuils) --- */
  const hasFileScoring = useMemo(() => {
    if (rows.length === 0) return { poids: true, seuils: true }; // show by default before import
    const hasPoids = rows.some(r => !r.isDefault.poids);
    const hasSeuils = rows.some(r => !r.isDefault.seuil_bon || !r.isDefault.seuil_moyen || !r.isDefault.seuil_mauvais);
    return { poids: hasPoids, seuils: hasSeuils };
  }, [rows]);

  /* --- Selection --- */
  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const someSelected = rows.some(r => r.selected);
  const toggleAll = () => setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  const toggleRow = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));

  /* --- Inline editing --- */
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (rowId: string, field: string, currentValue: string | number) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue));
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, isDefault: { ...r.isDefault, [field]: false } };
      if (['poids', 'seuil_bon', 'seuil_moyen', 'seuil_mauvais'].includes(field)) {
        (updated as any)[field] = Number(editValue) || 0;
      } else {
        (updated as any)[field] = editValue;
      }
      return updated;
    }));
    // Persist to DB if logged in
    const row = rows.find(r => r.id === rowId);
    if (user && row?.dbId) {
      const updateData: Record<string, any> = { [field]: ['poids', 'seuil_bon', 'seuil_moyen', 'seuil_mauvais'].includes(field) ? Number(editValue) || 0 : editValue };
      await supabase.from('prompt_matrix_items').update(updateData).eq('id', row.dbId);
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  /* --- Export results as CSV --- */
  const handleExportCsv = useCallback(() => {
    if (!results || results.length === 0) return;
    const header = ['KPI', 'Catégorie', hasFileScoring.poids ? 'Poids' : null, activeScoring.display.scoreLabel, 'Crawlers', hasFileScoring.seuils ? 'Seuil Bon' : null, hasFileScoring.seuils ? 'Seuil Moyen' : null, 'Verdict'].filter(Boolean).join(',');
    const lines = results.map((r: any) => {
      const row = rows.find(ro => ro.id === r.id || ro.prompt === r.prompt);
      const verdict = r.crawlers_score >= (row?.seuil_bon ?? 70) ? 'Bon' : r.crawlers_score >= (row?.seuil_moyen ?? 40) ? 'Moyen' : 'Mauvais';
      const parts = [`"${r.prompt}"`, `"${r.axe}"`, hasFileScoring.poids ? r.poids : null, r.parsed_score ?? r.crawlers_score, r.crawlers_score, hasFileScoring.seuils ? r.seuil_bon : null, hasFileScoring.seuils ? r.seuil_moyen : null, `"${verdict}"`].filter(v => v !== null);
      return parts.join(',');
    });
    const blob = new Blob(['\uFEFF' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matrice-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('Résultats exportés en CSV');
  }, [results, rows, hasFileScoring, activeScoring]);

  const selectedRows = useMemo(() => rows.filter(r => r.selected), [rows]);

  /* --- Analyze + persist session & results --- */
  const handleAnalyze = async () => {
    if (!url.trim()) { toast.error('Entrez une URL'); return; }
    if (selectedRows.length === 0) { toast.error('Sélectionnez au moins un KPI'); return; }
    setAnalyzing(true);
    setBenchmarkData(null);
    progress.reset();
    try {
      // ── BENCHMARK MODE ──────────────────────────────────────────────
      if (activeMatriceType === 'benchmark') {
        const benchmarkItems = selectedRows.map(row => ({
          id: row.id,
          prompt: row.prompt,
          theme: row.theme || row.axe || 'Général',
          engine: row.engine || 'ChatGPT',
          poids: row.poids,
          axe: row.axe,
          seuil_bon: row.seuil_bon,
          seuil_moyen: row.seuil_moyen,
          seuil_mauvais: row.seuil_mauvais,
          llm_name: row.isDefault.llm_name ? undefined : row.llm_name,
        }));

        // Tracker — emit pending events for every (prompt × engine) pair
        const benchEngines = Array.from(new Set(benchmarkItems.map(b => b.engine)));
        const benchSeeds = seedsForBenchmark(benchmarkItems, benchEngines, 'parse-matrix-geo');
        benchSeeds.forEach(s => progress.onCallEvent(makePending(s)));
        benchSeeds.forEach(s => progress.onCallEvent(makeRunning(s)));

        const { data: fnData, error: fnError } = await supabase.functions.invoke('parse-matrix-geo', {
          body: {
            url: url.trim(),
            benchmark_items: benchmarkItems,
            mode: 'benchmark',
            engine_notes: activeMetadata?.engineNotes,
            scoring_rubric: activeMetadata?.scoringGuide,
          },
        });

        if (fnError || !fnData?.success) {
          benchSeeds.forEach(s => progress.onCallEvent(makeError(s, fnData?.error || fnError?.message || 'Benchmark failed')));
          throw new Error(fnData?.error || fnError?.message || 'Benchmark failed');
        }

        benchSeeds.forEach(s => progress.onCallEvent(makeDone(s)));

        setBenchmarkData({
          results: fnData.results,
          themes: fnData.themes,
          engines: fnData.engines,
          heatmap: fnData.heatmap,
          globalScore: fnData.global_score,
          citationRate: fnData.citation_rate,
        });

        toast.success(`Benchmark terminé — Rang moyen: ${fnData.avg_rank || fnData.global_score}, Citations: ${fnData.citation_rate}%`);
        setAnalyzing(false);
        return;
      }

      // ── STANDARD MODE ───────────────────────────────────────────────
      // Build items payload for the edge function
      const items = selectedRows.map(row => ({
        id: row.id,
        prompt: row.prompt,
        llm_name: row.isDefault.llm_name ? undefined : row.llm_name,
        poids: row.poids,
        axe: row.axe,
        seuil_bon: row.seuil_bon,
        seuil_moyen: row.seuil_moyen,
        seuil_mauvais: row.seuil_mauvais,
      }));

      // Route to the correct edge function based on matrice type
      const functionName = activeMatriceType === 'geo' ? 'parse-matrix-geo'
        : activeMatriceType === 'hybrid' ? 'parse-matrix-hybrid'
        : 'audit-matrice';

      // Tracker — emit pending events for every prompt
      const stdSeeds = seedsForStandardAudit(items, functionName);
      stdSeeds.forEach(s => progress.onCallEvent(makePending(s)));
      stdSeeds.forEach(s => progress.onCallEvent(makeRunning(s)));

      const { data: fnData, error: fnError } = await supabase.functions.invoke(functionName, {
        body: {
          url: url.trim(),
          items,
          engine_notes: activeMetadata?.engineNotes,
          scoring_rubric: activeMetadata?.scoringGuide,
        },
      });

      if (fnError || !fnData?.success) {
        stdSeeds.forEach(s => progress.onCallEvent(makeError(s, fnData?.error || fnError?.message || 'Audit failed')));
        throw new Error(fnData?.error || fnError?.message || 'Audit failed');
      }

      stdSeeds.forEach(s => progress.onCallEvent(makeDone(s)));

      const auditResults = fnData.results.map((r: any) => ({
        id: r.id,
        prompt: r.prompt,
        axe: r.axe,
        poids: r.poids,
        crawlers_score: r.crawlers_score,
        parsed_score: r.parsed_score ?? r.crawlers_score,
        detected_type: r.detected_type,
        raw_data: r.raw_data,
        parsed_raw: r.parsed_raw,
        seuil_bon: r.seuil_bon,
        seuil_moyen: r.seuil_moyen,
        seuil_mauvais: r.seuil_mauvais,
        dbId: selectedRows.find(sr => sr.id === r.id)?.dbId,
      }));

      // Extract domain
      let domain = '';
      try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch { domain = url; }

      // Calculate global scores (simple average if no file weights)
      const useWeights = hasFileScoring.poids;
      const tw = useWeights ? auditResults.reduce((s: number, r: any) => s + r.poids, 0) : auditResults.length;
      const crawlersGlobal = tw > 0 ? Math.round(auditResults.reduce((s: number, r: any) => s + r.crawlers_score * (useWeights ? r.poids : 1), 0) / tw) : 0;

      // Persist audit session (only if logged in)
      if (user) {
        const { data: session, error: sessErr } = await supabase
          .from('matrix_audit_sessions')
          .insert({
            user_id: user.id,
            url: url.trim(),
            domain,
            crawlers_global_score: crawlersGlobal,
            csv_weighted_score: crawlersGlobal,
            total_prompts: rows.length,
            selected_prompts: selectedRows.length,
          })
          .select('id')
          .single();

        if (sessErr) console.error('Session save error:', sessErr);

        // Persist per-KPI results
        if (session) {
          const resultRows = auditResults.map((r: any) => {
            const verdict = r.crawlers_score >= r.seuil_bon ? 'bon' : r.crawlers_score >= r.seuil_moyen ? 'moyen' : 'mauvais';
            return {
              session_id: session.id,
              prompt_item_id: r.dbId || null,
              user_id: user.id,
              prompt: r.prompt,
              axe: r.axe,
              poids: r.poids,
              crawlers_score: r.crawlers_score,
              csv_weighted_score: r.crawlers_score,
              seuil_bon: r.seuil_bon,
              seuil_moyen: r.seuil_moyen,
              seuil_mauvais: r.seuil_mauvais,
              verdict,
            };
          });
          const { error: resErr } = await supabase.from('matrix_audit_results').insert(resultRows);
          if (resErr) console.error('Results save error:', resErr);
        }
      }

      setResults(auditResults);
      toast.success(`Analyse terminée — Score global : ${crawlersGlobal}/100`);
      window.dispatchEvent(new CustomEvent('expert-audit-complete', { detail: { source: 'matrice', url, score: crawlersGlobal } }));
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  };

  /* --- Report --- */
  const handleOpenReport = () => {
    if (!results || results.length === 0) { toast.error('Lancez une analyse d\'abord'); return; }
    const useWeights = hasFileScoring.poids;
    const tw = useWeights ? results.reduce((s: number, r: any) => s + r.poids, 0) : results.length;
    const reportData = {
      kind: 'matrice' as const,
      url,
      results: results.map((r: any) => ({ ...r, score: r.crawlers_score })),
      totalWeight: tw,
      weightedScore: tw > 0 ? Math.round(results.reduce((s: number, r: any) => s + r.crawlers_score * (useWeights ? r.poids : 1), 0) / tw) : 0,
      parsedWeightedScore: tw > 0 ? Math.round(results.reduce((s: number, r: any) => s + (r.parsed_score ?? r.crawlers_score) * (useWeights ? r.poids : 1), 0) / tw) : 0,
    };
    sessionStorage.setItem('rapport_matrice_data', JSON.stringify(reportData));

    // Sprint 4 — persist enriched MatrixResult[] for the interactive Pivot+Cube view
    const nativeResults: MatrixResult[] = results.map((r: any, i: number) => {
      const parsed = r.parsed_score ?? r.crawlers_score ?? null;
      const crawlers = r.crawlers_score ?? null;
      const matchType = parsed != null && crawlers != null && parsed !== crawlers ? 'partial' : 'exact';
      const cat = (r.axe || 'general')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
      const native = {
        criterionId: r.dbId || r.id || `row-${i}`,
        criterionTitle: r.prompt || `Critère ${i + 1}`,
        matchType,
        parsedScore: typeof parsed === 'number' ? parsed : null,
        parsedResponse: r.parsed_raw?.justification || r.parsed_raw?.seo_justification || null,
        crawlersScore: typeof crawlers === 'number' ? crawlers : null,
        crawlersData: r.raw_data ?? null,
        sourceFunction: `cat-${cat}`,
        confidence: 1,
      } as MatrixResult;
      (native as any).criterionCategory = cat;
      (native as any).criterionWeight = r.poids ?? 1;
      return native;
    });
    sessionStorage.setItem('rapport_matrice_results_native', JSON.stringify(nativeResults));

    window.open('/app/rapport/matrice', '_blank');
  };

  /* ── Dynamic explanation builders for hover tooltips ─────────── */
  const buildParsedExplanation = (row: MatrixRow, result: any): string => {
    const score = result.parsed_score;
    const raw = result.parsed_raw || {};
    const justification = raw.justification || raw.seo_justification || '';
    const prompt = row.prompt.length > 60 ? row.prompt.substring(0, 57) + '…' : row.prompt;

    if (activeScoring.direction === 'lower_better') {
      const context = result.citation_context || raw.scoring?.context || '';
      if (score === 0) return `Pour « ${prompt} », la marque n'a pas été citée par le moteur IA.`;
      let explanation = `Pour « ${prompt} », la marque apparaît en ${activeScoring.display.formatScore(score)}.`;
      if (context) explanation += ` Citation : "${context.length > 100 ? context.substring(0, 97) + '…' : context}"`;
      return explanation;
    }

    const formatted = activeScoring.display.formatScore(score);
    const color = activeScoring.display.formatColor(score, row.seuil_bon, row.seuil_moyen);
    const verdict = color === 'green' ? 'bon' : color === 'yellow' ? 'moyen' : 'insuffisant';
    let explanation = `Le LLM a évalué « ${prompt} » et a attribué ${formatted} (verdict : ${verdict}).`;
    if (justification) {
      explanation += ` Justification : ${justification.length > 120 ? justification.substring(0, 117) + '…' : justification}`;
    }
    if (result.geo_score != null) {
      explanation += ` Score GEO associé : ${result.geo_score}/100.`;
    }
    return explanation;
  };

  const buildCrawlersExplanation = (row: MatrixRow, result: any): string => {
    const score = result.crawlers_score;
    const rawData = result.raw_data || {};
    const engineScore = rawData.seo_engine;
    const detectedType = result.detected_type || 'auto';
    const prompt = row.prompt.length > 60 ? row.prompt.substring(0, 57) + '…' : row.prompt;
    const color = activeScoring.display.formatColor(score, row.seuil_bon, row.seuil_moyen);
    const verdict = color === 'green' ? 'bon' : color === 'yellow' ? 'moyen' : 'insuffisant';
    
    let explanation = `Pour « ${prompt} », Crawlers a mesuré ${activeScoring.display.formatScore(score)} (${verdict}) via ses micro-fonctions (type détecté : ${detectedType}).`;
    
    if (engineScore != null) {
      explanation += ` Score moteur technique pur : ${engineScore}/100, pondéré à 60% avec le score LLM à 40%.`;
    }
    
    const details: string[] = [];
    if (rawData.title_length != null) details.push(`title: ${rawData.title_length} car.`);
    if (rawData.meta_desc_length != null) details.push(`meta desc: ${rawData.meta_desc_length} car.`);
    if (rawData.h1_count != null) details.push(`H1: ${rawData.h1_count}`);
    if (rawData.lcp != null) details.push(`LCP: ${rawData.lcp}ms`);
    if (rawData.cls != null) details.push(`CLS: ${rawData.cls}`);
    if (rawData.robots_ok != null) details.push(`robots.txt: ${rawData.robots_ok ? '✓' : '✗'}`);
    if (rawData.sitemap_ok != null) details.push(`sitemap: ${rawData.sitemap_ok ? '✓' : '✗'}`);
    if (rawData.schema_types?.length) details.push(`schemas: ${rawData.schema_types.join(', ')}`);
    if (rawData.https != null) details.push(`HTTPS: ${rawData.https ? '✓' : '✗'}`);
    
    if (details.length > 0) {
      explanation += ` Détails : ${details.slice(0, 5).join(' · ')}.`;
    }
    
    return explanation;
  };


    const getScoreColor = (score: number, bon: number, moyen: number) => {
    const color = activeScoring.display.formatColor(score, bon, moyen);
    if (color === 'green') return 'text-green-600';
    if (color === 'yellow') return 'text-yellow-600';
    return 'text-red-600';
  };

  const AXE_COLORS: Record<string, string> = {
    'Général': 'bg-slate-500/15 text-slate-600 border-slate-300',
    'SEO': 'bg-blue-500/15 text-blue-600 border-blue-300',
    'Performance': 'bg-orange-500/15 text-orange-600 border-orange-300',
    'Sécurité': 'bg-red-500/15 text-red-600 border-red-300',
    'Contenu': 'bg-emerald-500/15 text-emerald-600 border-emerald-300',
    'Technique': 'bg-purple-500/15 text-purple-600 border-purple-300',
    'UX': 'bg-pink-500/15 text-pink-600 border-pink-300',
    'E-E-A-T': 'bg-amber-500/15 text-amber-600 border-amber-300',
    'GEO': 'bg-cyan-500/15 text-cyan-600 border-cyan-300',
    'Données structurées': 'bg-indigo-500/15 text-indigo-600 border-indigo-300',
    'Maillage': 'bg-teal-500/15 text-teal-600 border-teal-300',
  };

  const getAxeBadgeClass = (axe: string) => {
    return AXE_COLORS[axe] || 'bg-muted text-muted-foreground border-border';
  };

  const TYPE_COLORS: Record<string, string> = {
    'meta-tags': 'bg-blue-500/15 text-blue-600 border-blue-300',
    'structured-data': 'bg-indigo-500/15 text-indigo-600 border-indigo-300',
    'robots': 'bg-slate-500/15 text-slate-600 border-slate-300',
    'images': 'bg-amber-500/15 text-amber-600 border-amber-300',
    'backlinks': 'bg-violet-500/15 text-violet-600 border-violet-300',
    'content-quality': 'bg-emerald-500/15 text-emerald-600 border-emerald-300',
    'eeat': 'bg-orange-500/15 text-orange-600 border-orange-300',
    'pagespeed': 'bg-rose-500/15 text-rose-600 border-rose-300',
    'check-llm': 'bg-cyan-500/15 text-cyan-600 border-cyan-300',
    'check-geo': 'bg-teal-500/15 text-teal-600 border-teal-300',
    'cocoon': 'bg-purple-500/15 text-purple-600 border-purple-300',
  };

  const getTypeBadgeClass = (type: string) => {
    return TYPE_COLORS[type] || 'bg-muted text-muted-foreground border-border';
  };

  if (adminLoading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Matrice d'audit SEO & GEO | Crawlers.fr</title>
        <meta name="description" content="Composez votre grille d'audit sur-mesure : balises, données structurées, performance, sécurité, prompts LLM, métriques combinées. Score pondéré global." />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/matrice" />
        <meta property="og:title" content="Matrice d'audit SEO & GEO | Crawlers.fr" />
        <meta property="og:description" content="Composez votre grille d'audit sur-mesure : balises, données structurées, performance, sécurité, prompts LLM, métriques combinées. Score pondéré global." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Matrice d'audit SEO & GEO | Crawlers.fr" />
        <meta name="twitter:description" content="Composez votre grille d'audit sur-mesure : balises, données structurées, performance, sécurité, prompts LLM, métriques combinées. Score pondéré global." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-xl font-bold">Matrice d'audit</h1>
            <Badge variant="secondary" className="text-muted-foreground text-[10px]">BETA</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setShowHelp(true)} title="Aide">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setShowErrorDialog(true)}>
              <AlertTriangle className="h-3.5 w-3.5" /> Signaler une erreur
            </Button>
            {results && results.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
                  <FileSpreadsheet className="h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenReport}>
                  <FileText className="h-4 w-4" /> Rapport
                </Button>
              </>
            )}
          </div>

          {/* Error report dialog */}
          {showErrorDialog && (
            <div className="mb-6 border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold">Signaler une erreur</h3>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowErrorDialog(false)}>Annuler</Button>
              </div>
              <Input
                placeholder="Titre du problème"
                value={errorTitle}
                onChange={e => setErrorTitle(e.target.value)}
              />
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                placeholder="Description détaillée (optionnel)"
                value={errorDesc}
                onChange={e => setErrorDesc(e.target.value)}
              />
              <Button size="sm" onClick={handleReportError} disabled={!errorTitle.trim() || submittingError} className="gap-1.5">
                {submittingError ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                Envoyer
              </Button>
            </div>
          )}

          {/* Import row: import button + explanation */}
          <div className="flex items-center gap-3 mb-4">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.xlsm,.doc,.docx" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={docParsing} className="gap-2 shrink-0">
              {docParsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : <><Upload className="h-4 w-4" /> Importer</>}
            </Button>
            <p className="text-xs text-muted-foreground">Importez votre méthode d'audit dans un fichier .doc, .csv ou .xlsx.</p>
          </div>

          {/* Batch cards */}
          {batches.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {batches.map(b => (
                <div
                  key={b.batch_id}
                  onClick={() => handleBatchChange(b.batch_id)}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs ${
                    activeBatchId === b.batch_id
                      ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" />
                  {renamingBatchId === b.batch_id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleRenameBatch(b.batch_id, renameValue); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1"
                    >
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-6 text-xs w-36 px-1.5"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Escape') setRenamingBatchId(null); }}
                      />
                      <button type="submit" className="text-primary hover:text-primary/80"><Check className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setRenamingBatchId(null)} className="text-muted-foreground hover:text-foreground"><XIcon className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <span
                      className="font-medium truncate max-w-[180px]"
                      onDoubleClick={(e) => { e.stopPropagation(); setRenamingBatchId(b.batch_id); setRenameValue(b.batch_label); }}
                      title="Double-cliquer pour renommer"
                    >
                      {b.batch_label}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{b.count}</Badge>
                  {/* Rename button */}
                  {renamingBatchId !== b.batch_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingBatchId(b.batch_id); setRenameValue(b.batch_label); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title="Renommer"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {/* Delete button — hover only */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBatch(b.batch_id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* URL + Analyze — centered, reduced width */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2 w-full max-w-xl">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onFocus={() => { if (url === 'https://example.com') setUrl(''); }}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || docParsing || rows.length === 0}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyser
              </Button>
            </div>
          </div>

          {/* Sprint 4 — live progress tracker (visible during execution and right after) */}
          {(analyzing || progress.items.length > 0) && (
            <div className="mb-6 max-w-3xl mx-auto">
              <MatriceProgressTracker
                completed={progress.completed}
                total={progress.total}
                currentLabel={progress.currentLabel}
                items={progress.items}
              />
            </div>
          )}

          {/* Benchmark Heatmap (shown when benchmark mode has results) */}
          {benchmarkData && (
            <div className="mb-6 border rounded-lg p-4 bg-card">
              <h2 className="text-sm font-semibold mb-3 text-foreground">Benchmark Citabilité — Heatmap Thème × Engine</h2>
              <BenchmarkHeatmap
                results={benchmarkData.results}
                themes={benchmarkData.themes}
                engines={benchmarkData.engines}
                heatmap={benchmarkData.heatmap}
                globalScore={benchmarkData.globalScore}
                citationRate={benchmarkData.citationRate}
              />
            </div>
          )}

          {/* Matrix table */}
          {rows.length > 0 && !benchmarkData && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Tout sélectionner"
                        className="border-muted-foreground/40 data-[state=checked]:bg-muted-foreground/60 data-[state=checked]:border-muted-foreground/60"
                      />
                    </TableHead>
                     <TableHead className="cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('prompt')}>
                       <span className="flex items-center gap-1 text-xs font-semibold">
                         {columnLabels.prompt || 'KPI'}
                         {sortField === 'prompt' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                       </span>
                     </TableHead>
                     <TableHead className="w-28 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('axe')}>
                       <span className="flex items-center gap-1 text-xs font-semibold">
                         {columnLabels.axe || smartLabels.axe}
                         {sortField === 'axe' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                       </span>
                     </TableHead>
                      {hasFileScoring.poids && (
                        <TableHead className="w-20 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('poids')}>
                          <span className="flex items-center gap-1 text-xs font-semibold">
                            {columnLabels.poids || smartLabels.poids}
                            {sortField === 'poids' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                          </span>
                        </TableHead>
                      )}
                      {hasFileScoring.seuils && (
                        <>
                          <TableHead className="w-20 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('seuil_bon')}>
                            <span className="flex items-center gap-1 text-xs font-semibold">
                              {columnLabels.seuil_bon || smartLabels.seuil_bon}
                              {sortField === 'seuil_bon' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                            </span>
                          </TableHead>
                          <TableHead className="w-20 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('seuil_moyen')}>
                            <span className="flex items-center gap-1 text-xs font-semibold">
                              {columnLabels.seuil_moyen || smartLabels.seuil_moyen}
                              {sortField === 'seuil_moyen' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                            </span>
                          </TableHead>
                          <TableHead className="w-20 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort('seuil_mauvais')}>
                            <span className="flex items-center gap-1 text-xs font-semibold">
                              {columnLabels.seuil_mauvais || smartLabels.seuil_mauvais}
                              {sortField === 'seuil_mauvais' && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                            </span>
                          </TableHead>
                        </>
                      )}
                     {results && <TableHead className="w-20">Type</TableHead>}
                      {results && <TableHead className="w-24 text-center">{activeScoring.display.scoreLabel}</TableHead>}
                      {results && <TableHead className="w-24 text-center">{activeScoring.direction === 'lower_better' ? activeScoring.display.resultLabel : 'Crawlers'}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map(row => {
                    const resultRow = results?.find((r: any) => r.id === row.id || r.prompt === row.prompt);
                    return (
                      <TableRow key={row.id} className={!row.selected ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={() => toggleRow(row.id)}
                            className="border-muted-foreground/40 data-[state=checked]:bg-muted-foreground/60 data-[state=checked]:border-muted-foreground/60"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm" style={{ minWidth: '240px', maxWidth: '480px' }}>
                          {editingCell?.rowId === row.id && editingCell.field === 'prompt' ? (
                            <form onSubmit={e => { e.preventDefault(); commitEdit(); }} className="flex gap-1">
                              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-xs" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} />
                              <button type="submit"><Check className="h-3.5 w-3.5 text-primary" /></button>
                            </form>
                          ) : (
                            <span className="block whitespace-pre-wrap break-words leading-relaxed cursor-pointer hover:text-primary/80" onDoubleClick={() => startEdit(row.id, 'prompt', row.prompt)}>{row.prompt}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.rowId === row.id && editingCell.field === 'axe' ? (
                            <form onSubmit={e => { e.preventDefault(); commitEdit(); }} className="flex gap-1">
                              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-[10px] w-20" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} />
                              <button type="submit"><Check className="h-3 w-3 text-primary" /></button>
                            </form>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 cursor-pointer ${getAxeBadgeClass(row.axe)}`} onDoubleClick={() => startEdit(row.id, 'axe', row.axe)}>
                              {row.axe}
                            </Badge>
                          )}
                        </TableCell>
                        {hasFileScoring.poids && (
                          <TableCell className="cursor-pointer" onDoubleClick={() => startEdit(row.id, 'poids', row.poids)}>
                            {editingCell?.rowId === row.id && editingCell.field === 'poids' ? (
                              <form onSubmit={e => { e.preventDefault(); commitEdit(); }}>
                                <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-xs w-16" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} onBlur={commitEdit} />
                              </form>
                            ) : row.poids}
                          </TableCell>
                        )}
                        {hasFileScoring.seuils && (
                          <>
                            <TableCell className="cursor-pointer" onDoubleClick={() => startEdit(row.id, 'seuil_bon', row.seuil_bon)}>
                              {editingCell?.rowId === row.id && editingCell.field === 'seuil_bon' ? (
                                <form onSubmit={e => { e.preventDefault(); commitEdit(); }}>
                                  <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-xs w-14" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} onBlur={commitEdit} />
                                </form>
                              ) : row.seuil_bon}
                            </TableCell>
                            <TableCell className="cursor-pointer" onDoubleClick={() => startEdit(row.id, 'seuil_moyen', row.seuil_moyen)}>
                              {editingCell?.rowId === row.id && editingCell.field === 'seuil_moyen' ? (
                                <form onSubmit={e => { e.preventDefault(); commitEdit(); }}>
                                  <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-xs w-14" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} onBlur={commitEdit} />
                                </form>
                              ) : row.seuil_moyen}
                            </TableCell>
                            <TableCell className="cursor-pointer" onDoubleClick={() => startEdit(row.id, 'seuil_mauvais', row.seuil_mauvais)}>
                              {editingCell?.rowId === row.id && editingCell.field === 'seuil_mauvais' ? (
                                <form onSubmit={e => { e.preventDefault(); commitEdit(); }}>
                                  <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-xs w-14" autoFocus onKeyDown={e => e.key === 'Escape' && cancelEdit()} onBlur={commitEdit} />
                                </form>
                              ) : row.seuil_mauvais}
                            </TableCell>
                          </>
                        )}
                        {results && (
                          <TableCell>
                            {resultRow ? (
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getTypeBadgeClass(resultRow.detected_type)}`}>
                                {resultRow.detected_type || '—'}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        )}
                        {results && (
                          <TableCell className={`font-bold text-center group/parsed ${resultRow ? getScoreColor(resultRow.parsed_score, row.seuil_bon, row.seuil_moyen) : ''}`}>
                            {resultRow ? (
                              <span className="inline-flex items-center gap-1">
                                {activeScoring.display.formatScore(resultRow.parsed_score)}
                                <HoverCard openDelay={200}>
                                  <HoverCardTrigger asChild>
                                    <button className="opacity-0 group-hover/parsed:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                                      <HelpCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" className="w-80 text-xs font-normal text-left">
                                    <p className="font-semibold text-foreground mb-1">
                                      {activeScoring.display.scoreLabel} — {activeScoring.display.formatScore(resultRow.parsed_score)}
                                    </p>
                                    <p className="text-muted-foreground">{buildParsedExplanation(row, resultRow)}</p>
                                  </HoverCardContent>
                                </HoverCard>
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        {results && (
                          <TableCell className={`font-bold text-center group/crawlers ${resultRow ? getScoreColor(resultRow.crawlers_score, row.seuil_bon, row.seuil_moyen) : ''}`}>
                            {resultRow ? (
                              <span className="inline-flex items-center gap-1">
                                {activeScoring.display.formatScore(resultRow.crawlers_score)}
                                <HoverCard openDelay={200}>
                                  <HoverCardTrigger asChild>
                                    <button className="opacity-0 group-hover/crawlers:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                                      <HelpCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" className="w-80 text-xs font-normal text-left">
                                    <p className="font-semibold text-foreground mb-1">
                                      {activeScoring.display.resultLabel} — {activeScoring.display.formatScore(resultRow.crawlers_score)}
                                    </p>
                                    <p className="text-muted-foreground">{buildCrawlersExplanation(row, resultRow)}</p>
                                  </HoverCardContent>
                                </HoverCard>
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
                <span>{selectedRows.length}/{rows.length} KPIs sélectionnés</span>
                <Badge variant="outline" className="text-[9px]">{activeScoring.label}</Badge>
                {results && (() => {
                  const active = results.filter((r: any) => selectedRows.some(s => s.id === r.id || s.prompt === r.prompt));
                  if (active.length === 0) return null;
                  // Use weighted average only if file provided weights, otherwise simple average
                  const useWeights = hasFileScoring.poids;
                  const tw = useWeights ? active.reduce((s: number, r: any) => s + r.poids, 0) : active.length;
                  if (tw === 0) return null;
                  const parsedScore = Math.round(active.reduce((s: number, r: any) => s + (r.parsed_score ?? r.crawlers_score) * (useWeights ? r.poids : 1), 0) / tw);
                  const crawlersScore = Math.round(active.reduce((s: number, r: any) => s + r.crawlers_score * (useWeights ? r.poids : 1), 0) / tw);
                  return (
                    <span className="ml-auto font-medium text-foreground flex gap-4">
                      <span>{activeScoring.display.scoreLabel} : {activeScoring.display.formatScore(parsedScore)}</span>
                      <span className="text-primary">Crawlers : {activeScoring.display.formatScore(crawlersScore)}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Upload className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Importez un fichier .csv, .xlsx ou .doc pour commencer</p>
              <p className="text-xs mt-1">Colonnes supportées : prompt, poids, axe, seuil_bon, seuil_moyen, seuil_mauvais, llm_name</p>
            </div>
          )}
        </main>
      </div>
      <MatriceHelpModal open={showHelp} onOpenChange={setShowHelp} />
      <ImportStepper
        open={xlsxStepperOpen}
        sheetNames={xlsxStepperSheets}
        workbook={xlsxWorkbookRef}
        onComplete={({ rows: importedRows, matriceType, identityCard, metadata }) => {
          setXlsxStepperOpen(false);
          setActiveMatriceType(matriceType);
          setActiveMetadata(metadata || null);
          // Auto-detect scoring method from imported data
          const headers = importedRows.length > 0 ? Object.keys(importedRows[0]) : [];
          const detection = detectScoringMethod(headers, importedRows.slice(0, 10), matriceType);
          setActiveScoringMethod(detection.method);
          if (detection.source !== 'default') {
            toast.info(`Méthode de scoring détectée : ${getScoringConfig(detection.method).label} (confiance: ${Math.round(detection.confidence * 100)}%)`, { duration: 4000 });
          }
          if (metadata) {
            const parts: string[] = [];
            if (metadata.engineNotes.length > 0) parts.push(`${metadata.engineNotes.length} instructions moteur`);
            if (metadata.scoringGuide.length > 0) parts.push(`${metadata.scoringGuide.length} critères de scoring`);
            if (parts.length > 0) toast.success(`Métadonnées intégrées : ${parts.join(', ')}`, { duration: 4000 });
          }
          processImportedRows(importedRows, xlsxFileName, matriceType, detection.method);
          setXlsxWorkbookRef(null);
          if (identityCard?.brandUrl && !url.trim()) {
            setUrl(identityCard.brandUrl);
            toast.info(`URL pré-remplie depuis la carte d'identité : ${identityCard.brandUrl}`);
          }
        }}
        onClose={() => { setXlsxStepperOpen(false); setXlsxWorkbookRef(null); }}
      />
    </>
  );
}
