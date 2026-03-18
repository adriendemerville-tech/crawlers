import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, Eye, GitCompare, Blend, Trash2, Download, Filter, ArrowUpDown, ChevronDown, ChevronUp, X, Check, FlaskConical, Search, Play, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Types ──────────────────────────────────────────────────────

/** Audit axes that map to Crawlers functions */
export type AuditAxis = 'technique' | 'semantique' | 'eeat' | 'geo' | 'maillage' | 'contenu' | 'backlinks' | 'performance';

interface ColumnMapping {
  prompt: string;
  poids?: string;
  axe?: string;
  seuil_bon?: string;
  seuil_moyen?: string;
  seuil_mauvais?: string;
  llm_name?: string;
  score?: string;
  brand_found?: string;
}

interface MatrixRow {
  prompt: string;
  poids: number;
  axe: AuditAxis;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name?: string;
  score?: number;
  brand_found?: boolean;
  is_default_poids: boolean;
  is_default_axe: boolean;
  is_default_seuils: boolean;
  [key: string]: unknown;
}

interface PromptMatrixCardProps {
  trackedSiteId: string;
  userId: string;
  domain: string;
}

// ── Default values from Crawlers scoring system ──
const DEFAULT_WEIGHTS: Record<AuditAxis, number> = {
  technique: 20,
  semantique: 20,
  eeat: 15,
  geo: 15,
  maillage: 10,
  contenu: 10,
  backlinks: 10,
  performance: 20,
};

const DEFAULT_SEUILS = { bon: 70, moyen: 40, mauvais: 0 };

const AXIS_LABELS: Record<AuditAxis, string> = {
  technique: 'Technique',
  semantique: 'Sémantique',
  eeat: 'E-E-A-T',
  geo: 'GEO',
  maillage: 'Maillage',
  contenu: 'Contenu',
  backlinks: 'Backlinks',
  performance: 'Performance',
};

const AXIS_COLORS: Record<AuditAxis, string> = {
  technique: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  semantique: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  eeat: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  geo: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  maillage: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  contenu: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  backlinks: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  performance: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
};

// ── Semantic columns for CSV mapping ──
const MAPPABLE_COLUMNS = [
  { key: 'prompt', label: 'Prompt / Critère', required: true },
  { key: 'poids', label: 'Poids (coefficient)', required: false },
  { key: 'axe', label: 'Axe d\'audit (technique, GEO...)', required: false },
  { key: 'seuil_bon', label: 'Seuil Bon (0-100)', required: false },
  { key: 'seuil_moyen', label: 'Seuil Moyen (0-100)', required: false },
  { key: 'seuil_mauvais', label: 'Seuil Mauvais (0-100)', required: false },
  { key: 'llm_name', label: 'Nom du LLM', required: false },
  { key: 'score', label: 'Score (0-100)', required: false },
  { key: 'brand_found', label: 'Marque trouvée (oui/non)', required: false },
];

// ── Auto-detect axis from prompt text ──
function detectAxis(prompt: string): AuditAxis {
  const lower = prompt.toLowerCase();
  if (/core web vital|lcp|cls|fid|ttfb|fcp|vitesse|speed|chargement|performance/.test(lower)) return 'performance';
  if (/technique|html|meta|balise|canonical|hreflang|robots|sitemap|redirect|404|301/.test(lower)) return 'technique';
  if (/schema\.org|json-ld|sémantique|structured|données structurées|opengraph|microdata/.test(lower)) return 'semantique';
  if (/e-?e-?a-?t|auteur|expertise|autorité|confiance|author|trust/.test(lower)) return 'eeat';
  if (/geo|llms\.txt|citab|faq|ia génér|generative|llm|chatgpt|gemini|perplexity/.test(lower)) return 'geo';
  if (/maillage|lien interne|internal link|profondeur|crawl depth|pagerank/.test(lower)) return 'maillage';
  if (/contenu|content|mot-clé|keyword|texte|rédaction|longue traîne/.test(lower)) return 'contenu';
  if (/backlink|netlinking|domaine référent|referring|autorité domaine|DA/.test(lower)) return 'backlinks';
  return 'technique'; // fallback
}

// ── Normalize axis string from CSV ──
function normalizeAxis(raw: string): AuditAxis | null {
  const lower = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, AuditAxis> = {
    'technique': 'technique', 'technical': 'technique', 'tech': 'technique',
    'semantique': 'semantique', 'semantic': 'semantique', 'sem': 'semantique',
    'eeat': 'eeat', 'e-e-a-t': 'eeat', 'eat': 'eeat',
    'geo': 'geo', 'aeo': 'geo', 'generative': 'geo', 'llm': 'geo',
    'maillage': 'maillage', 'linking': 'maillage', 'internal': 'maillage',
    'contenu': 'contenu', 'content': 'contenu',
    'backlinks': 'backlinks', 'backlink': 'backlinks', 'netlinking': 'backlinks',
    'performance': 'performance', 'perf': 'performance', 'speed': 'performance', 'vitesse': 'performance',
  };
  return map[lower] || null;
}

// ── Mock data for demo ──
const MOCK_PROMPTS_DATA: Array<{ prompt: string; axe: AuditAxis; poids: number }> = [
  { prompt: 'Vérifier la présence du fichier llms.txt', axe: 'geo', poids: 20 },
  { prompt: 'Analyser la structure des données JSON-LD', axe: 'semantique', poids: 18 },
  { prompt: 'Évaluer les Core Web Vitals (LCP, CLS)', axe: 'performance', poids: 22 },
  { prompt: 'Vérifier les balises H1-H6 et canonical', axe: 'technique', poids: 15 },
  { prompt: 'Analyser les signaux E-E-A-T de l\'auteur', axe: 'eeat', poids: 12 },
  { prompt: 'Mesurer la citabilité du contenu par les LLMs', axe: 'geo', poids: 18 },
  { prompt: 'Audit du maillage interne et profondeur', axe: 'maillage', poids: 10 },
  { prompt: 'Analyse des backlinks et domaines référents', axe: 'backlinks', poids: 8 },
  { prompt: 'Qualité et pertinence du contenu principal', axe: 'contenu', poids: 14 },
  { prompt: 'FAQ structurée avec balisage schema.org', axe: 'geo', poids: 16 },
];

function generateMockData(): MatrixRow[] {
  return MOCK_PROMPTS_DATA.map(p => ({
    prompt: p.prompt,
    poids: p.poids,
    axe: p.axe,
    seuil_bon: 70,
    seuil_moyen: 40,
    seuil_mauvais: 0,
    is_default_poids: false,
    is_default_axe: false,
    is_default_seuils: true,
  }));
}

// ── Default badge component ──
function DefaultBadge({ label }: { label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[8px] px-1 py-0 border-dashed border-amber-500/50 text-amber-600 dark:text-amber-400 ml-1 cursor-help">
            défaut
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          {label} — valeur par défaut de Crawlers (non spécifiée dans le CSV)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PromptMatrixCard({ trackedSiteId, userId, domain }: PromptMatrixCardProps) {
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasImport, setHasImport] = useState(false);
  const [importFileName, setImportFileName] = useState('');

  // Mapping dialog state
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);
  const [pendingFileName, setPendingFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // URL audit state
  const [auditUrl, setAuditUrl] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<Record<number, { score: number; details: string }> | null>(null);

  // Filters
  const [filterAxe, setFilterAxe] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortField, setSortField] = useState<string>('axe');
  const [sortAsc, setSortAsc] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  // ── Load demo data ──
  const loadDemoData = useCallback(() => {
    setMatrixRows(generateMockData());
    setHasImport(true);
    setImportFileName('demo-simulation.csv');
    setDemoMode(true);
    setLoading(false);
  }, []);

  // ── Fetch existing import ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('prompt_matrix_imports' as any)
        .select('id, file_name, row_count, created_at, column_mapping, raw_data')
        .eq('tracked_site_id', trackedSiteId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && (data as any[]).length > 0) {
        const imp = (data as any[])[0];
        setMatrixRows(imp.raw_data as MatrixRow[]);
        setHasImport(true);
        setImportFileName(imp.file_name as string);
      } else {
        setMatrixRows([]);
        setHasImport(false);
        setImportFileName('');
      }
    } catch (err) {
      console.error('PromptMatrix fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [trackedSiteId]);

  useEffect(() => { if (!demoMode) fetchData(); }, [fetchData, demoMode]);

  const exitDemoMode = useCallback(() => {
    setDemoMode(false);
    setMatrixRows([]);
    setHasImport(false);
    setImportFileName('');
    setAuditResults(null);
    fetchData();
  }, [fetchData]);

  // ── CSV Upload handler ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv')) {
      toast.error('Format non supporté. Utilisez un fichier .csv');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 5 Mo)');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          toast.error('Le fichier CSV est vide ou mal formaté');
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvRawRows(results.data as Record<string, string>[]);
        setPendingFileName(file.name);

        // Auto-detect mapping
        const autoMap: Record<string, string> = {};
        headers.forEach(h => {
          const lower = h.toLowerCase().trim();
          if (/prompt|question|query|requête|critère|criteria/i.test(lower)) autoMap.prompt = h;
          if (/poids|weight|coefficient|coeff|pondéra/i.test(lower)) autoMap.poids = h;
          if (/axe|axis|module|catégorie|category|type/i.test(lower)) autoMap.axe = h;
          if (/seuil.*bon|threshold.*good|bon|good/i.test(lower) && !/moyen|mauvais/i.test(lower)) autoMap.seuil_bon = h;
          if (/seuil.*moyen|threshold.*medium|moyen|medium|average/i.test(lower)) autoMap.seuil_moyen = h;
          if (/seuil.*mauvais|threshold.*bad|mauvais|bad|poor/i.test(lower)) autoMap.seuil_mauvais = h;
          if (/llm|model|modèle|engine/i.test(lower)) autoMap.llm_name = h;
          if (/score|note|rating/i.test(lower)) autoMap.score = h;
          if (/brand|marque|found|trouvé/i.test(lower)) autoMap.brand_found = h;
        });
        setColumnMapping(autoMap);
        setShowMappingDialog(true);
      },
      error: (err) => {
        toast.error(`Erreur de parsing : ${err.message}`);
      },
    });
    e.target.value = '';
  }, []);

  // ── Confirm mapping & save (replaces previous import) ──
  const handleConfirmMapping = useCallback(async () => {
    if (!columnMapping.prompt) {
      toast.error('La colonne "Prompt / Critère" est obligatoire.');
      return;
    }

    const mappedRows: MatrixRow[] = csvRawRows.map(row => {
      const prompt = row[columnMapping.prompt] || '';
      if (!prompt.trim()) return null;

      // Parse poids
      let poids = DEFAULT_WEIGHTS.technique;
      let is_default_poids = true;
      if (columnMapping.poids && row[columnMapping.poids]) {
        const parsed = parseFloat(row[columnMapping.poids]);
        if (!isNaN(parsed)) { poids = parsed; is_default_poids = false; }
      }

      // Parse axe
      let axe: AuditAxis = detectAxis(prompt);
      let is_default_axe = true;
      if (columnMapping.axe && row[columnMapping.axe]) {
        const normalized = normalizeAxis(row[columnMapping.axe]);
        if (normalized) { axe = normalized; is_default_axe = false; }
      }

      // If poids was default, use the axis default weight
      if (is_default_poids) poids = DEFAULT_WEIGHTS[axe];

      // Parse seuils
      let seuil_bon = DEFAULT_SEUILS.bon;
      let seuil_moyen = DEFAULT_SEUILS.moyen;
      let seuil_mauvais = DEFAULT_SEUILS.mauvais;
      let is_default_seuils = true;

      if (columnMapping.seuil_bon && row[columnMapping.seuil_bon]) {
        const v = parseFloat(row[columnMapping.seuil_bon]);
        if (!isNaN(v)) { seuil_bon = v; is_default_seuils = false; }
      }
      if (columnMapping.seuil_moyen && row[columnMapping.seuil_moyen]) {
        const v = parseFloat(row[columnMapping.seuil_moyen]);
        if (!isNaN(v)) { seuil_moyen = v; is_default_seuils = false; }
      }
      if (columnMapping.seuil_mauvais && row[columnMapping.seuil_mauvais]) {
        const v = parseFloat(row[columnMapping.seuil_mauvais]);
        if (!isNaN(v)) { seuil_mauvais = v; is_default_seuils = false; }
      }

      const mapped: MatrixRow = {
        prompt,
        poids,
        axe,
        seuil_bon,
        seuil_moyen,
        seuil_mauvais,
        is_default_poids,
        is_default_axe,
        is_default_seuils,
      };

      if (columnMapping.llm_name && row[columnMapping.llm_name]) {
        mapped.llm_name = row[columnMapping.llm_name];
      }
      if (columnMapping.score && row[columnMapping.score]) {
        mapped.score = parseFloat(row[columnMapping.score]) || undefined;
      }
      if (columnMapping.brand_found && row[columnMapping.brand_found]) {
        const val = row[columnMapping.brand_found].toLowerCase();
        mapped.brand_found = ['oui', 'yes', 'true', '1', 'vrai'].includes(val);
      }

      return mapped;
    }).filter(Boolean) as MatrixRow[];

    if (mappedRows.length === 0) {
      toast.error('Aucune ligne valide trouvée après le mapping.');
      return;
    }

    try {
      // Delete previous imports for this site (replace behavior)
      await supabase
        .from('prompt_matrix_imports' as any)
        .delete()
        .eq('tracked_site_id', trackedSiteId);

      const { error } = await supabase
        .from('prompt_matrix_imports' as any)
        .insert({
          tracked_site_id: trackedSiteId,
          user_id: userId,
          domain,
          file_name: pendingFileName,
          column_mapping: columnMapping,
          raw_data: mappedRows,
          row_count: mappedRows.length,
        } as any);

      if (error) throw error;

      toast.success(`${mappedRows.length} critères importés depuis ${pendingFileName} (import précédent remplacé)`);
      setShowMappingDialog(false);
      setAuditResults(null);
      fetchData();
    } catch (err: any) {
      toast.error(`Erreur d'import : ${err.message}`);
    }
  }, [columnMapping, csvRawRows, pendingFileName, trackedSiteId, userId, domain, fetchData]);

  // ── Launch audit on URL ──
  const handleLaunchAudit = useCallback(async () => {
    if (!auditUrl.trim()) {
      toast.error('Veuillez saisir une URL à auditer');
      return;
    }

    let normalizedUrl = auditUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;

    setAuditing(true);
    setAuditResults(null);

    try {
      // Build the custom prompt matrix payload
      const matrixPayload = matrixRows.map((row, idx) => ({
        index: idx,
        prompt: row.prompt,
        poids: row.poids,
        axe: row.axe,
        seuil_bon: row.seuil_bon,
        seuil_moyen: row.seuil_moyen,
        seuil_mauvais: row.seuil_mauvais,
      }));

      // Store in prompt_deployments for the audit to pick up
      const sessionId = crypto.randomUUID();
      const { error: deployError } = await supabase
        .from('prompt_deployments')
        .insert({
          tracked_site_id: trackedSiteId,
          user_id: userId,
          target_type: 'onsite',
          prompt_text: JSON.stringify(matrixPayload),
          prompt_label: `matrix-audit-${sessionId}`,
          api_used: 'prompt-matrix-audit',
          llm_model: 'gemini-2.5-flash',
          source_csv_filename: importFileName,
          estimated_cost_eur: 0,
        });

      if (deployError) throw deployError;

      // Invoke the audit function with the matrix session
      const { data, error } = await supabase.functions.invoke('audit-strategique-ia', {
        body: {
          url: normalizedUrl,
          toolsData: null,
          promptMatrixSessionId: sessionId,
          lang: 'fr',
        },
      });

      if (error) throw error;

      // Parse results and map back to rows
      if (data?.scores || data?.result) {
        const scores = data.scores || data.result?.scores || {};
        const results: Record<number, { score: number; details: string }> = {};
        matrixRows.forEach((row, idx) => {
          const axeScore = scores[row.axe];
          if (axeScore !== undefined) {
            results[idx] = {
              score: typeof axeScore === 'number' ? axeScore : parseFloat(axeScore) || 0,
              details: data.result?.recommendations?.[row.axe] || '',
            };
          }
        });
        setAuditResults(results);
        toast.success('Audit terminé avec vos prompts personnalisés');
      } else {
        toast.info('Audit lancé — les résultats seront affinés avec les données Crawlers');
      }
    } catch (err: any) {
      console.error('Matrix audit error:', err);
      toast.error(`Erreur d'audit : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setAuditing(false);
    }
  }, [auditUrl, matrixRows, trackedSiteId, userId]);

  // ── Unique axes ──
  const uniqueAxes = useMemo(() => {
    const set = new Set<AuditAxis>();
    matrixRows.forEach(r => set.add(r.axe));
    return Array.from(set).sort();
  }, [matrixRows]);

  // ── Total weight ──
  const totalWeight = useMemo(() => matrixRows.reduce((sum, r) => sum + r.poids, 0), [matrixRows]);

  // ── Filtered + sorted ──
  const displayRows = useMemo(() => {
    let rows = [...matrixRows];

    if (filterAxe !== 'all') {
      rows = rows.filter(r => r.axe === filterAxe);
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      rows = rows.filter(r => r.prompt.toLowerCase().includes(q) || r.axe.toLowerCase().includes(q));
    }

    rows.sort((a, b) => {
      const aVal = a[sortField as keyof MatrixRow];
      const bVal = b[sortField as keyof MatrixRow];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [matrixRows, filterAxe, filterQuery, sortField, sortAsc]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    sortField === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />
  );

  const scoreColor = (score: number, row: MatrixRow) => {
    if (score >= row.seuil_bon) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= row.seuil_moyen) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Matrice de Prompts
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Matrice de Prompts
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
              </CardTitle>
              <CardDescription>
                Importez vos critères d'audit personnalisés (prompts, poids, axes, seuils) et auditez n'importe quelle URL
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasImport && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {importFileName} ({matrixRows.length})
                </Badge>
              )}
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    {hasImport ? 'Remplacer CSV' : 'Importer CSV'}
                  </span>
                </Button>
                <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* No data state */}
          {!hasImport && !demoMode && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">Aucune matrice importée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importez un CSV avec vos prompts, poids et axes d'audit.
                  <br />Les colonnes manquantes seront complétées par les valeurs par défaut de Crawlers.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <label className="cursor-pointer inline-block">
                  <Button size="sm" className="gap-1.5" asChild>
                    <span>
                      <Upload className="h-3.5 w-3.5" />
                      Choisir un fichier CSV
                    </span>
                  </Button>
                  <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFileUpload} />
                </label>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={loadDemoData}>
                  <FlaskConical className="h-3.5 w-3.5" />
                  Données simulées
                </Button>
              </div>
              {/* Expected format info */}
              <div className="mt-4 text-left max-w-md mx-auto bg-muted/30 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Colonnes attendues :</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5">
                  <li><strong>prompt</strong> — critère ou question d'audit <span className="text-destructive">*</span></li>
                  <li><strong>poids</strong> — coefficient (défaut : poids Crawlers par axe)</li>
                  <li><strong>axe</strong> — technique, semantique, eeat, geo, maillage, contenu, backlinks, performance</li>
                  <li><strong>seuil_bon / seuil_moyen / seuil_mauvais</strong> — seuils personnalisés (défaut : 70/40/0)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Demo mode banner */}
          {demoMode && (
            <div className="flex items-center justify-between bg-accent/50 border border-accent rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-accent-foreground flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Mode démo — données simulées
              </span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={exitDemoMode}>
                Quitter la démo
              </Button>
            </div>
          )}

          {/* URL Audit field */}
          {hasImport && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Auditer une URL avec vos critères</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="https://example.com/page-a-auditer"
                  value={auditUrl}
                  onChange={e => setAuditUrl(e.target.value)}
                  className="h-9 text-sm flex-1"
                  onKeyDown={e => e.key === 'Enter' && !auditing && handleLaunchAudit()}
                />
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={handleLaunchAudit}
                  disabled={auditing || !auditUrl.trim()}
                >
                  {auditing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Audit en cours...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Lancer l'audit
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {matrixRows.length} critères × {uniqueAxes.length} axes — Poids total : {totalWeight.toFixed(0)}
                {matrixRows.some(r => r.is_default_poids || r.is_default_axe || r.is_default_seuils) && (
                  <span className="ml-2">
                    <Info className="h-3 w-3 inline text-amber-500 mr-0.5" />
                    Certaines valeurs utilisent les défauts Crawlers
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Data table */}
          {hasImport && (
            <>
              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un critère..."
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    className="h-8 w-48 text-xs"
                  />
                </div>
                <Select value={filterAxe} onValueChange={setFilterAxe}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Tous les axes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les axes</SelectItem>
                    {uniqueAxes.map(axe => (
                      <SelectItem key={axe} value={axe}>{AXIS_LABELS[axe]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {displayRows.length} critère{displayRows.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('prompt')}>
                        <div className="flex items-center gap-1">Critère <SortIcon field="prompt" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('axe')}>
                        <div className="flex items-center gap-1">Axe <SortIcon field="axe" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('poids')}>
                        <div className="flex items-center gap-1 justify-end">Poids <SortIcon field="poids" /></div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center">Seuils</TableHead>
                      {auditResults && (
                        <TableHead className="cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('score')}>
                          <div className="flex items-center gap-1 justify-end">Score <SortIcon field="score" /></div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={auditResults ? 5 : 4} className="text-center text-muted-foreground py-8">
                          Aucun résultat
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayRows.map((row, i) => {
                        const rowIndex = matrixRows.indexOf(row);
                        const result = auditResults?.[rowIndex];
                        return (
                          <TableRow key={i}>
                            <TableCell className="max-w-[300px] truncate text-xs" title={row.prompt}>
                              {row.prompt}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${AXIS_COLORS[row.axe]}`}>
                                  {AXIS_LABELS[row.axe]}
                                </Badge>
                                {row.is_default_axe && <DefaultBadge label="Axe" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              <div className="flex items-center justify-end gap-1">
                                {row.poids}
                                {row.is_default_poids && <DefaultBadge label="Poids" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{row.seuil_bon}</span>
                                <span className="text-[10px] text-muted-foreground">/</span>
                                <span className="text-[10px] text-amber-600 dark:text-amber-400">{row.seuil_moyen}</span>
                                <span className="text-[10px] text-muted-foreground">/</span>
                                <span className="text-[10px] text-rose-600 dark:text-rose-400">{row.seuil_mauvais}</span>
                                {row.is_default_seuils && <DefaultBadge label="Seuils" />}
                              </div>
                            </TableCell>
                            {auditResults && (
                              <TableCell className={`text-right font-mono text-sm font-bold ${result ? scoreColor(result.score, row) : ''}`}>
                                {result ? result.score.toFixed(0) : '—'}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Weight summary by axis */}
              <div className="flex flex-wrap gap-2">
                {uniqueAxes.map(axe => {
                  const axeRows = matrixRows.filter(r => r.axe === axe);
                  const axeWeight = axeRows.reduce((s, r) => s + r.poids, 0);
                  const pct = totalWeight > 0 ? ((axeWeight / totalWeight) * 100).toFixed(0) : '0';
                  return (
                    <div key={axe} className={`rounded px-2 py-1 text-[10px] border ${AXIS_COLORS[axe]}`}>
                      {AXIS_LABELS[axe]}: {axeRows.length} critères — {pct}%
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Column Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Mapping des colonnes — {pendingFileName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Associez vos colonnes CSV aux champs Crawlers. Seul "Prompt" est obligatoire — le reste sera complété par les valeurs par défaut.
            </p>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              Aperçu : <strong>{csvRawRows.length}</strong> lignes, <strong>{csvHeaders.length}</strong> colonnes
              {hasImport && <span className="text-amber-600 dark:text-amber-400 ml-2">⚠ L'import précédent sera remplacé</span>}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-auto">
              {MAPPABLE_COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-3">
                  <span className="text-sm w-52 shrink-0">
                    {col.label}
                    {col.required && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                  <Select
                    value={columnMapping[col.key] || '__none__'}
                    onValueChange={v => setColumnMapping(prev => {
                      const next = { ...prev };
                      if (v === '__none__') delete next[col.key];
                      else next[col.key] = v;
                      return next;
                    })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="— Non mappé —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Non mappé (défaut Crawlers) —</SelectItem>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvRawRows.length > 0 && columnMapping.prompt && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Aperçu (3 premières lignes) :</p>
                <div className="rounded border overflow-auto max-h-32">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Prompt</TableHead>
                        {columnMapping.poids && <TableHead className="text-xs">Poids</TableHead>}
                        {columnMapping.axe && <TableHead className="text-xs">Axe</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRawRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs truncate max-w-[200px]">{row[columnMapping.prompt]}</TableCell>
                          {columnMapping.poids && <TableCell className="text-xs">{row[columnMapping.poids] || <span className="text-amber-500 italic">défaut</span>}</TableCell>}
                          {columnMapping.axe && <TableCell className="text-xs">{row[columnMapping.axe] || <span className="text-amber-500 italic">auto</span>}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMappingDialog(false)}>Annuler</Button>
              <Button size="sm" onClick={handleConfirmMapping} disabled={!columnMapping.prompt} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Importer {csvRawRows.length} critères
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
