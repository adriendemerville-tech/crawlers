import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Upload, Search, Loader2, ArrowLeft, FileText, Trash2, FileDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Header } from '@/components/Header';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MatrixRow {
  id: string;
  dbId?: string; // prompt_matrix_items UUID
  prompt: string;
  poids: number;
  axe: string;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name: string;
  selected: boolean;
  isDefault: Record<string, boolean>;
}

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
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch management
  interface Batch { batch_id: string; batch_label: string; created_at: string; count: number; }
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [submittingError, setSubmittingError] = useState(false);

  const LAST_BATCH_KEY = 'matrice_last_batch_id';

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

  // Guard: authenticated users only
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

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
          map.set(row.batch_id, { batch_id: row.batch_id, batch_label: row.batch_label, created_at: row.created_at, count: 0 });
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

  // Load a specific batch's prompts
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
    setResults(null);
    localStorage.setItem(LAST_BATCH_KEY, batchId);
  };

  // Switch batch
  const handleBatchChange = async (batchId: string) => {
    setActiveBatchId(batchId);
    await loadBatch(batchId);
  };

  /* --- Parse raw rows into MatrixRow[] and persist --- */
  const processImportedRows = useCallback(async (rawRows: any[], fileName: string) => {
    if (!user) return;
    const newBatchId = crypto.randomUUID();
    const parsed: MatrixRow[] = rawRows.map((raw: any, i: number) => {
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
        prompt: raw.prompt || raw.Prompt || raw.kpi || raw.KPI || `KPI #${i + 1}`,
        poids: val('poids', DEFAULTS.poids),
        axe: val('axe', DEFAULTS.axe),
        seuil_bon: val('seuil_bon', DEFAULTS.seuil_bon),
        seuil_moyen: val('seuil_moyen', DEFAULTS.seuil_moyen),
        seuil_mauvais: val('seuil_mauvais', DEFAULTS.seuil_mauvais),
        llm_name: val('llm_name', DEFAULTS.llm_name),
        selected: true,
        isDefault,
      };
    });

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

    const newBatch: Batch = { batch_id: newBatchId, batch_label: fileName, created_at: new Date().toISOString(), count: parsed.length };
    setBatches(prev => [newBatch, ...prev]);
    setActiveBatchId(newBatchId);
    localStorage.setItem(LAST_BATCH_KEY, newBatchId);

    setRows(parsed);
    setResults(null);
    toast.success(`${parsed.length} KPIs importés — "${fileName}"`);
  }, [user]);

  /* --- File Import (CSV + DOC/DOCX) --- */
  const [docParsing, setDocParsing] = useState(false);
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const fileName = file.name.replace(/\.csv$/i, '');
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result) => {
          await processImportedRows(result.data, fileName);
        },
        error: () => toast.error('Erreur de parsing CSV'),
      });
    } else if (ext === 'doc' || ext === 'docx') {
      // Send to edge function for AI extraction
      setDocParsing(true);
      const formData = new FormData();
      formData.append('file', file);
      supabase.functions.invoke('parse-doc-matrix', {
        body: formData,
      }).then(({ data, error }) => {
        setDocParsing(false);
        if (error || !data?.rows?.length) {
          toast.error(error?.message || 'Aucune donnée exploitable trouvée dans le document');
          return;
        }
        const fileName = file.name.replace(/\.(doc|docx)$/i, '');
        processImportedRows(data.rows, fileName);
      }).catch(() => {
        setDocParsing(false);
        toast.error('Erreur lors du parsing du document');
      });
    } else {
      toast.error('Format non supporté. Utilisez .csv, .doc ou .docx');
    }
    e.target.value = '';
  }, [user, processImportedRows]);

  /* --- Selection --- */
  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const someSelected = rows.some(r => r.selected);
  const toggleAll = () => setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  const toggleRow = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));

  const selectedRows = useMemo(() => rows.filter(r => r.selected), [rows]);

  /* --- Analyze + persist session & results --- */
  const handleAnalyze = async () => {
    if (!url.trim()) { toast.error('Entrez une URL'); return; }
    if (selectedRows.length === 0) { toast.error('Sélectionnez au moins un KPI'); return; }
    if (!user) return;
    setAnalyzing(true);
    try {
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

      // Call real audit-matrice edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke('audit-matrice', {
        body: { url: url.trim(), items },
      });

      if (fnError || !fnData?.success) {
        throw new Error(fnData?.error || fnError?.message || 'Audit failed');
      }

      const auditResults = fnData.results.map((r: any) => ({
        id: r.id,
        prompt: r.prompt,
        axe: r.axe,
        poids: r.poids,
        crawlers_score: r.crawlers_score,
        detected_type: r.detected_type,
        raw_data: r.raw_data,
        seuil_bon: r.seuil_bon,
        seuil_moyen: r.seuil_moyen,
        seuil_mauvais: r.seuil_mauvais,
        dbId: selectedRows.find(sr => sr.id === r.id)?.dbId,
      }));

      // Extract domain
      let domain = '';
      try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch { domain = url; }

      // Calculate global scores
      const tw = auditResults.reduce((s: number, r: any) => s + r.poids, 0);
      const crawlersGlobal = tw > 0 ? Math.round(auditResults.reduce((s: number, r: any) => s + r.crawlers_score * r.poids, 0) / tw) : 0;

      // Persist audit session
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

      setResults(auditResults);
      toast.success(`Analyse terminée — Score global : ${crawlersGlobal}/100`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  };

  /* --- Report --- */
  const handleOpenReport = () => {
    if (!results || results.length === 0) { toast.error('Lancez une analyse d\'abord'); return; }
    const tw = results.reduce((s: number, r: any) => s + r.poids, 0);
    const reportData = {
      kind: 'matrice' as const,
      url,
      results,
      totalWeight: tw,
      weightedScore: tw > 0 ? Math.round(results.reduce((s: number, r: any) => s + r.crawlers_score * r.poids, 0) / tw) : 0,
    };
    sessionStorage.setItem('rapport_matrice_data', JSON.stringify(reportData));
    window.open('/rapport/matrice', '_blank');
  };

  const getScoreColor = (score: number, bon: number, moyen: number) => {
    if (score >= bon) return 'text-green-600';
    if (score >= moyen) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (adminLoading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Matrice d'audit SEO & GEO | Crawlers.fr</title>
        <meta name="description" content="Composez votre grille d'audit sur-mesure : balises, données structurées, performance, sécurité, prompts LLM, métriques combinées. Score pondéré global." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/console')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Console
            </Button>
            <h1 className="text-xl font-bold">Matrice d'audit</h1>
            <Badge variant="secondary" className="text-muted-foreground text-[10px]">BETA</Badge>
            <Link to="/cocoon">
              <Button variant="ghost" size="sm" className="gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BETA</span>
                <span className="text-sm font-semibold">Cocoon</span>
              </Button>
            </Link>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setShowErrorDialog(true)}>
              <AlertTriangle className="h-3.5 w-3.5" /> Signaler une erreur
            </Button>
            {results && results.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenReport}>
                <FileText className="h-4 w-4" /> Rapport
              </Button>
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

          {/* CSV Selector + Import + URL */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Row 1: CSV batch selector + import */}
            <div className="flex items-center gap-3">
              <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
              {batches.length > 0 ? (
                <Select value={activeBatchId || ''} onValueChange={handleBatchChange}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Sélectionner un CSV…" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(b => (
                      <SelectItem key={b.batch_id} value={b.batch_id}>
                        {b.batch_label} ({b.count} KPIs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">Aucun fichier importé</span>
              )}
              <input ref={fileInputRef} type="file" accept=".csv,.doc,.docx" className="hidden" onChange={handleFileImport} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={docParsing} className="gap-2">
                {docParsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : <><Upload className="h-4 w-4" /> Importer</>}
              </Button>
              {rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setRows([]); setResults(null); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Row 2: URL + analyze */}
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || rows.length === 0}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-none"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyser
              </Button>
            </div>
          </div>

          {/* Matrix table */}
          {rows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Prompt / KPI</TableHead>
                    <TableHead className="w-20">Poids</TableHead>
                    <TableHead className="w-28">Axe</TableHead>
                    <TableHead className="w-20">Bon</TableHead>
                    <TableHead className="w-20">Moyen</TableHead>
                    <TableHead className="w-20">Mauvais</TableHead>
                    <TableHead className="w-36">Modèle</TableHead>
                    {results && <TableHead className="w-20">Type</TableHead>}
                    {results && <TableHead className="w-24">Crawlers</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const resultRow = results?.find((r: any) => r.id === row.id || r.prompt === row.prompt);
                    return (
                      <TableRow key={row.id} className={!row.selected ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={() => toggleRow(row.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-xs truncate">{row.prompt}</TableCell>
                        <TableCell>
                          {row.poids}
                          {row.isDefault.poids && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          {row.axe}
                          {row.isDefault.axe && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          {row.seuil_bon}
                          {row.isDefault.seuil_bon && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          {row.seuil_moyen}
                          {row.isDefault.seuil_moyen && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          {row.seuil_mauvais}
                          {row.isDefault.seuil_mauvais && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {row.llm_name}
                          {row.isDefault.llm_name && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Default</Badge>}
                        </TableCell>
                        {results && (
                          <TableCell>
                            {resultRow ? (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {resultRow.detected_type || '—'}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        )}
                        {results && (
                          <TableCell className={`font-bold ${resultRow ? getScoreColor(resultRow.crawlers_score, row.seuil_bon, row.seuil_moyen) : ''}`}>
                            {resultRow ? `${resultRow.crawlers_score}/100` : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
                <span>{selectedRows.length}/{rows.length} KPIs sélectionnés</span>
                {results && (() => {
                  const active = results.filter((r: any) => selectedRows.some(s => s.id === r.id || s.prompt === r.prompt));
                  const tw = active.reduce((s: number, r: any) => s + r.poids, 0);
                  if (tw === 0) return null;
                  const crawlersScore = Math.round(active.reduce((s: number, r: any) => s + r.crawlers_score * r.poids, 0) / tw);
                  return (
                    <span className="ml-auto font-medium text-foreground">
                      Score Crawlers pondéré : {crawlersScore}/100
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Upload className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Importez un fichier .csv ou .doc pour commencer</p>
              <p className="text-xs mt-1">Colonnes supportées : prompt, poids, axe, seuil_bon, seuil_moyen, seuil_mauvais, llm_name</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
