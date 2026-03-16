import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, Eye, GitCompare, Blend, Trash2, Download, Filter, ArrowUpDown, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';

// ── Types ──────────────────────────────────────────────────────

interface ColumnMapping {
  prompt: string;
  llm_name: string;
  score?: string;
  brand_found?: string;
  position?: string;
  response_text?: string;
  date?: string;
}

interface MatrixRow {
  prompt: string;
  llm_name: string;
  score?: number;
  brand_found?: boolean;
  position?: number;
  response_text?: string;
  date?: string;
  [key: string]: unknown;
}

interface CrawlersData {
  llm_visibility: Array<{ llm_name: string; score_percentage: number; week_start_date: string }>;
  llm_depth: Array<{ llm_name: string; prompt_text: string; response_summary: string; iteration: number }>;
  llm_test_executions: Array<{ llm_name: string; prompt_tested: string; brand_found: boolean; iteration_found: number | null; response_text: string | null }>;
}

interface PromptMatrixCardProps {
  trackedSiteId: string;
  userId: string;
  domain: string;
}

// ── Semantic columns the user can map to ──
const MAPPABLE_COLUMNS = [
  { key: 'prompt', label: 'Prompt', required: true },
  { key: 'llm_name', label: 'Nom du LLM', required: true },
  { key: 'score', label: 'Score (0-100)', required: false },
  { key: 'brand_found', label: 'Marque trouvée (oui/non)', required: false },
  { key: 'position', label: 'Position / Itération', required: false },
  { key: 'response_text', label: 'Texte de réponse', required: false },
  { key: 'date', label: 'Date', required: false },
];

// ── Main Component ─────────────────────────────────────────────

export function PromptMatrixCard({ trackedSiteId, userId, domain }: PromptMatrixCardProps) {
  const [imports, setImports] = useState<Array<{ id: string; file_name: string; row_count: number; created_at: string; column_mapping: ColumnMapping; raw_data: MatrixRow[] }>>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [crawlersData, setCrawlersData] = useState<CrawlersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'client' | 'compare' | 'weighted'>('client');

  // Mapping dialog state
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);
  const [pendingFileName, setPendingFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Filters
  const [filterLLM, setFilterLLM] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortField, setSortField] = useState<string>('prompt');
  const [sortAsc, setSortAsc] = useState(true);

  // ── Fetch existing imports + Crawlers data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [importsRes, visRes, depthRes, execRes] = await Promise.all([
        supabase
          .from('prompt_matrix_imports' as any)
          .select('id, file_name, row_count, created_at, column_mapping, raw_data')
          .eq('tracked_site_id', trackedSiteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('llm_visibility_scores')
          .select('llm_name, score_percentage, week_start_date')
          .eq('tracked_site_id', trackedSiteId)
          .order('week_start_date', { ascending: false })
          .limit(100),
        supabase
          .from('llm_depth_conversations')
          .select('llm_name, prompt_text, response_summary, iteration')
          .eq('tracked_site_id', trackedSiteId)
          .limit(200),
        supabase
          .from('llm_test_executions')
          .select('llm_name, prompt_tested, brand_found, iteration_found, response_text')
          .eq('tracked_site_id', trackedSiteId)
          .limit(200),
      ]);

      if (importsRes.data) {
        const typed = (importsRes.data as any[]).map(d => ({
          id: d.id as string,
          file_name: d.file_name as string,
          row_count: d.row_count as number,
          created_at: d.created_at as string,
          column_mapping: d.column_mapping as ColumnMapping,
          raw_data: d.raw_data as MatrixRow[],
        }));
        setImports(typed);
        if (typed.length > 0 && !selectedImportId) {
          setSelectedImportId(typed[0].id);
        }
      }

      setCrawlersData({
        llm_visibility: (visRes.data || []) as CrawlersData['llm_visibility'],
        llm_depth: (depthRes.data || []) as CrawlersData['llm_depth'],
        llm_test_executions: (execRes.data || []) as CrawlersData['llm_test_executions'],
      });
    } catch (err) {
      console.error('PromptMatrix fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [trackedSiteId, selectedImportId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          if (/prompt|question|query|requête/i.test(lower)) autoMap.prompt = h;
          if (/llm|model|modèle|engine/i.test(lower)) autoMap.llm_name = h;
          if (/score|note|rating/i.test(lower)) autoMap.score = h;
          if (/brand|marque|found|trouvé/i.test(lower)) autoMap.brand_found = h;
          if (/position|rank|iteration/i.test(lower)) autoMap.position = h;
          if (/response|réponse|answer|text/i.test(lower)) autoMap.response_text = h;
          if (/date|timestamp|time/i.test(lower)) autoMap.date = h;
        });
        setColumnMapping(autoMap);
        setShowMappingDialog(true);
      },
      error: (err) => {
        toast.error(`Erreur de parsing : ${err.message}`);
      },
    });

    // Reset input
    e.target.value = '';
  }, []);

  // ── Confirm mapping & save ──
  const handleConfirmMapping = useCallback(async () => {
    if (!columnMapping.prompt || !columnMapping.llm_name) {
      toast.error('Les colonnes "Prompt" et "Nom du LLM" sont obligatoires.');
      return;
    }

    // Transform raw CSV rows using the mapping
    const mappedRows: MatrixRow[] = csvRawRows.map(row => {
      const mapped: MatrixRow = {
        prompt: row[columnMapping.prompt] || '',
        llm_name: row[columnMapping.llm_name] || '',
      };
      if (columnMapping.score && row[columnMapping.score]) {
        mapped.score = parseFloat(row[columnMapping.score]) || undefined;
      }
      if (columnMapping.brand_found && row[columnMapping.brand_found]) {
        const val = row[columnMapping.brand_found].toLowerCase();
        mapped.brand_found = ['oui', 'yes', 'true', '1', 'vrai'].includes(val);
      }
      if (columnMapping.position && row[columnMapping.position]) {
        mapped.position = parseInt(row[columnMapping.position]) || undefined;
      }
      if (columnMapping.response_text) {
        mapped.response_text = row[columnMapping.response_text] || undefined;
      }
      if (columnMapping.date) {
        mapped.date = row[columnMapping.date] || undefined;
      }
      return mapped;
    }).filter(r => r.prompt && r.llm_name);

    if (mappedRows.length === 0) {
      toast.error('Aucune ligne valide trouvée après le mapping.');
      return;
    }

    try {
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

      toast.success(`${mappedRows.length} lignes importées depuis ${pendingFileName}`);
      setShowMappingDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(`Erreur d'import : ${err.message}`);
    }
  }, [columnMapping, csvRawRows, pendingFileName, trackedSiteId, userId, domain, fetchData]);

  // ── Delete import ──
  const handleDeleteImport = useCallback(async (importId: string) => {
    const { error } = await supabase
      .from('prompt_matrix_imports' as any)
      .delete()
      .eq('id', importId);
    if (error) {
      toast.error('Erreur de suppression');
    } else {
      toast.success('Import supprimé');
      if (selectedImportId === importId) setSelectedImportId(null);
      fetchData();
    }
  }, [selectedImportId, fetchData]);

  // ── Current data ──
  const selectedImport = imports.find(i => i.id === selectedImportId);
  const clientRows = selectedImport?.raw_data || [];

  // ── Unique LLMs ──
  const uniqueLLMs = useMemo(() => {
    const set = new Set<string>();
    clientRows.forEach(r => set.add(r.llm_name));
    crawlersData?.llm_test_executions.forEach(r => set.add(r.llm_name));
    crawlersData?.llm_depth.forEach(r => set.add(r.llm_name));
    return Array.from(set).sort();
  }, [clientRows, crawlersData]);

  // ── Merged data for comparison / weighted ──
  const mergedRows = useMemo(() => {
    if (!crawlersData) return clientRows.map(r => ({ ...r, source: 'client' as const, crawlers_score: undefined as number | undefined, crawlers_brand_found: undefined as boolean | undefined, weighted_score: r.score }));

    const crawlersMap = new Map<string, { score?: number; brand_found?: boolean; position?: number }>();
    crawlersData.llm_test_executions.forEach(exec => {
      const key = `${exec.prompt_tested.toLowerCase().trim()}::${exec.llm_name.toLowerCase().trim()}`;
      crawlersMap.set(key, {
        brand_found: exec.brand_found,
        position: exec.iteration_found ?? undefined,
      });
    });

    // Add visibility scores by LLM
    const latestVisibility = new Map<string, number>();
    crawlersData.llm_visibility.forEach(v => {
      const k = v.llm_name.toLowerCase().trim();
      if (!latestVisibility.has(k)) latestVisibility.set(k, v.score_percentage);
    });

    return clientRows.map(row => {
      const key = `${row.prompt.toLowerCase().trim()}::${row.llm_name.toLowerCase().trim()}`;
      const crawlerMatch = crawlersMap.get(key);
      const visScore = latestVisibility.get(row.llm_name.toLowerCase().trim());
      const crawlers_score = crawlerMatch ? (crawlerMatch.brand_found ? (visScore ?? 75) : (visScore ?? 25)) : visScore;
      const crawlers_brand_found = crawlerMatch?.brand_found;

      let weighted_score = row.score;
      if (row.score !== undefined && crawlers_score !== undefined) {
        weighted_score = Math.round(row.score * 0.5 + crawlers_score * 0.5);
      } else if (crawlers_score !== undefined) {
        weighted_score = crawlers_score;
      }

      return {
        ...row,
        source: 'client' as const,
        crawlers_score,
        crawlers_brand_found,
        weighted_score,
      };
    });
  }, [clientRows, crawlersData]);

  // ── Filtered + sorted ──
  const displayRows = useMemo(() => {
    let rows = viewMode === 'client' ? clientRows.map(r => ({ ...r, source: 'client' as const, crawlers_score: undefined as number | undefined, crawlers_brand_found: undefined as boolean | undefined, weighted_score: r.score })) : mergedRows;

    if (filterLLM !== 'all') {
      rows = rows.filter(r => r.llm_name === filterLLM);
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      rows = rows.filter(r => r.prompt.toLowerCase().includes(q) || r.llm_name.toLowerCase().includes(q));
    }

    rows.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a];
      const bVal = b[sortField as keyof typeof b];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [clientRows, mergedRows, viewMode, filterLLM, filterQuery, sortField, sortAsc]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    sortField === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />
  );

  const scoreColor = (score?: number) => {
    if (score === undefined) return '';
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400';
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
              <CardDescription>Importez votre matrice CSV et comparez avec les données Crawlers</CardDescription>
            </div>
            <div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    Importer CSV
                  </span>
                </Button>
                <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Import selector */}
          {imports.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Import :</span>
              {imports.map(imp => (
                <div key={imp.id} className="flex items-center gap-1">
                  <Badge
                    variant={selectedImportId === imp.id ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedImportId(imp.id)}
                  >
                    {imp.file_name} ({imp.row_count} lignes)
                  </Badge>
                  <button onClick={() => handleDeleteImport(imp.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No data state */}
          {imports.length === 0 && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">Aucune matrice importée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importez un fichier CSV contenant vos prompts, LLMs et résultats.
                  <br />Format libre — vous mapperez vos colonnes après l'upload.
                </p>
              </div>
              <label className="cursor-pointer inline-block">
                <Button size="sm" className="gap-1.5" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    Choisir un fichier CSV
                  </span>
                </Button>
                <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {/* Data view */}
          {selectedImport && (
            <>
              {/* View mode tabs */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)} className="space-y-3">
                <TabsList className="grid grid-cols-3 w-full max-w-md">
                  <TabsTrigger value="client" className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Données Client
                  </TabsTrigger>
                  <TabsTrigger value="compare" className="gap-1.5 text-xs">
                    <GitCompare className="h-3.5 w-3.5" />
                    Comparaison
                  </TabsTrigger>
                  <TabsTrigger value="weighted" className="gap-1.5 text-xs">
                    <Blend className="h-3.5 w-3.5" />
                    Pondéré
                  </TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un prompt..."
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                      className="h-8 w-48 text-xs"
                    />
                  </div>
                  <Select value={filterLLM} onValueChange={setFilterLLM}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue placeholder="Tous les LLMs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les LLMs</SelectItem>
                      {uniqueLLMs.map(llm => (
                        <SelectItem key={llm} value={llm}>{llm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {displayRows.length} résultat{displayRows.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Table */}
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('prompt')}>
                          <div className="flex items-center gap-1">Prompt <SortIcon field="prompt" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('llm_name')}>
                          <div className="flex items-center gap-1">LLM <SortIcon field="llm_name" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('score')}>
                          <div className="flex items-center gap-1 justify-end">Score Client <SortIcon field="score" /></div>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-center">Marque</TableHead>
                        {(viewMode === 'compare' || viewMode === 'weighted') && (
                          <>
                            <TableHead className="cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('crawlers_score')}>
                              <div className="flex items-center gap-1 justify-end">Score Crawlers <SortIcon field="crawlers_score" /></div>
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-center">Marque Crawlers</TableHead>
                          </>
                        )}
                        {viewMode === 'weighted' && (
                          <TableHead className="cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('weighted_score')}>
                            <div className="flex items-center gap-1 justify-end">Score Pondéré <SortIcon field="weighted_score" /></div>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={viewMode === 'weighted' ? 7 : viewMode === 'compare' ? 6 : 4} className="text-center text-muted-foreground py-8">
                            Aucun résultat
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[300px] truncate text-xs" title={row.prompt}>{row.prompt}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{row.llm_name}</Badge>
                            </TableCell>
                            <TableCell className={`text-right font-mono text-sm ${scoreColor(row.score)}`}>
                              {row.score !== undefined ? row.score : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.brand_found === true && <Check className="h-4 w-4 text-emerald-500 mx-auto" />}
                              {row.brand_found === false && <X className="h-4 w-4 text-rose-400 mx-auto" />}
                              {row.brand_found === undefined && <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            {(viewMode === 'compare' || viewMode === 'weighted') && (
                              <>
                                <TableCell className={`text-right font-mono text-sm ${scoreColor(row.crawlers_score)}`}>
                                  {row.crawlers_score !== undefined ? row.crawlers_score.toFixed(0) : '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {row.crawlers_brand_found === true && <Check className="h-4 w-4 text-emerald-500 mx-auto" />}
                                  {row.crawlers_brand_found === false && <X className="h-4 w-4 text-rose-400 mx-auto" />}
                                  {row.crawlers_brand_found === undefined && <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                              </>
                            )}
                            {viewMode === 'weighted' && (
                              <TableCell className={`text-right font-bold font-mono text-sm ${scoreColor(row.weighted_score)}`}>
                                {row.weighted_score !== undefined ? row.weighted_score : '—'}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Legend */}
                {viewMode === 'weighted' && (
                  <p className="text-[10px] text-muted-foreground">
                    Score pondéré = 50% score client + 50% score Crawlers. Les lignes sans correspondance Crawlers utilisent le score client ou la visibilité LLM globale.
                  </p>
                )}
                {viewMode === 'compare' && (
                  <p className="text-[10px] text-muted-foreground">
                    La colonne "Score Crawlers" utilise les données LLM Visibility et LLM Test Executions pour le même domaine. Le matching se fait par prompt × LLM.
                  </p>
                )}
              </Tabs>
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
              Associez vos colonnes CSV aux champs attendus. Seuls "Prompt" et "Nom du LLM" sont obligatoires.
            </p>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              Aperçu : <strong>{csvRawRows.length}</strong> lignes, <strong>{csvHeaders.length}</strong> colonnes détectées
            </div>

            <div className="space-y-3">
              {MAPPABLE_COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-3">
                  <span className="text-sm w-44 shrink-0">
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
                      <SelectItem value="__none__">— Non mappé —</SelectItem>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            {csvRawRows.length > 0 && columnMapping.prompt && columnMapping.llm_name && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Aperçu (3 premières lignes) :</p>
                <div className="rounded border overflow-auto max-h-32">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Prompt</TableHead>
                        <TableHead className="text-xs">LLM</TableHead>
                        {columnMapping.score && <TableHead className="text-xs">Score</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRawRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs truncate max-w-[200px]">{row[columnMapping.prompt]}</TableCell>
                          <TableCell className="text-xs">{row[columnMapping.llm_name]}</TableCell>
                          {columnMapping.score && <TableCell className="text-xs">{row[columnMapping.score]}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMappingDialog(false)}>Annuler</Button>
              <Button size="sm" onClick={handleConfirmMapping} disabled={!columnMapping.prompt || !columnMapping.llm_name} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Importer {csvRawRows.length} lignes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
