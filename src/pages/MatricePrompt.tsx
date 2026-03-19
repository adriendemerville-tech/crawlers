import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Upload, Search, Loader2, ArrowLeft, FileText, Trash2, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Header } from '@/components/Header';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Papa from 'papaparse';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MatrixRow {
  id: string;
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

  // Guard: admin only
  useEffect(() => {
    if (!adminLoading && !authLoading) {
      if (!user) navigate('/auth');
      else if (!isAdmin) navigate('/console');
    }
  }, [isAdmin, adminLoading, authLoading, user, navigate]);

  /* --- CSV Import --- */
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: MatrixRow[] = result.data.map((raw: any, i: number) => {
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
        setRows(parsed);
        setResults(null);
        toast.success(`${parsed.length} KPIs importés`);
      },
      error: () => toast.error('Erreur de parsing CSV'),
    });
    e.target.value = '';
  }, []);

  /* --- Selection --- */
  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const someSelected = rows.some(r => r.selected);
  const toggleAll = () => setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  const toggleRow = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));

  const selectedRows = useMemo(() => rows.filter(r => r.selected), [rows]);

  /* --- Analyze stub --- */
  const handleAnalyze = async () => {
    if (!url.trim()) { toast.error('Entrez une URL'); return; }
    if (selectedRows.length === 0) { toast.error('Sélectionnez au moins un KPI'); return; }
    setAnalyzing(true);
    try {
      // Simulate analysis with selected KPIs
      await new Promise(r => setTimeout(r, 2000));
      const mockResults = selectedRows.map(row => ({
        prompt: row.prompt,
        axe: row.axe,
        poids: row.poids,
        score: Math.round(Math.random() * 100),
        seuil_bon: row.seuil_bon,
        seuil_moyen: row.seuil_moyen,
        seuil_mauvais: row.seuil_mauvais,
      }));
      setResults(mockResults);
      toast.success('Analyse terminée');
    } catch {
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  };

  /* --- Report --- */
  const handleOpenReport = () => {
    if (!results || results.length === 0) { toast.error('Lancez une analyse d\'abord'); return; }
    const reportData = {
      kind: 'matrice' as const,
      url,
      results,
      totalWeight: results.reduce((s: number, r: any) => s + r.poids, 0),
      weightedScore: (() => {
        const tw = results.reduce((s: number, r: any) => s + r.poids, 0);
        if (tw === 0) return 0;
        return Math.round(results.reduce((s: number, r: any) => s + r.score * r.poids, 0) / tw);
      })(),
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
      <Helmet><title>Matrice de Prompts — Crawlers AI</title></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/console')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Console
            </Button>
            <h1 className="text-xl font-bold">Matrice de Prompts</h1>
            <Badge variant="secondary" className="text-muted-foreground text-[10px]">BETA</Badge>
            <div className="flex-1" />
            {results && results.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenReport}>
                <FileText className="h-4 w-4" /> Rapport
              </Button>
            )}
          </div>

          {/* Import + URL */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Importer .csv
            </Button>

            <div className="flex-1 flex gap-2">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || rows.length === 0}
                className="gap-2"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyser
              </Button>
            </div>

            {rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setRows([]); setResults(null); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
                    {results && <TableHead className="w-20">Score</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const resultRow = results?.find(r => r.prompt === row.prompt);
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
                          <TableCell className={`font-bold ${resultRow ? getScoreColor(resultRow.score, row.seuil_bon, row.seuil_moyen) : ''}`}>
                            {resultRow ? `${resultRow.score}/100` : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
                <span>{selectedRows.length}/{rows.length} KPIs sélectionnés</span>
                {results && (
                  <span className="ml-auto font-medium text-foreground">
                    Score pondéré : {(() => {
                      const active = results.filter(r => selectedRows.some(s => s.prompt === r.prompt));
                      const tw = active.reduce((s, r) => s + r.poids, 0);
                      if (tw === 0) return '—';
                      return Math.round(active.reduce((s, r) => s + r.score * r.poids, 0) / tw) + '/100';
                    })()}
                  </span>
                )}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Upload className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Importez un fichier .csv pour commencer</p>
              <p className="text-xs mt-1">Colonnes supportées : prompt, poids, axe, seuil_bon, seuil_moyen, seuil_mauvais, llm_name</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
