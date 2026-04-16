import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Plus, Trash2, Globe, Clock } from 'lucide-react';
import { SerpBenchmark, type SerpBenchmarkHandle } from './SerpBenchmark';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'fr' ? fr : lang === 'es' ? es : en;

interface IndexationCheck {
  id: string;
  page_url: string;
  verdict: string;
  coverage_state: string | null;
  indexing_state: string | null;
  crawled_as: string | null;
  last_crawl_time: string | null;
  robots_txt_state: string | null;
  page_fetch_state: string | null;
  rich_results_errors: any;
  referring_urls: string[];
  checked_at: string;
}

function verdictBadge(verdict: string) {
  if (verdict === 'PASS') {
    return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 gap-1"><CheckCircle2 className="h-3 w-3" /> Indexé</Badge>;
  }
  if (verdict === 'FAIL' || verdict === 'NEUTRAL') {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Non indexé</Badge>;
  }
  if (verdict === 'PARTIAL') {
    return <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 gap-1"><AlertTriangle className="h-3 w-3" /> Partiel</Badge>;
  }
  return <Badge variant="secondary" className="gap-1">Inconnu</Badge>;
}

interface IndexationMonitorProps {
  externalSiteId?: string | null;
  externalDomain?: string | null;
}

export function IndexationMonitor({ externalSiteId, externalDomain }: IndexationMonitorProps = {}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [trackedSites, setTrackedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [checks, setChecks] = useState<IndexationCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [inspectingManual, setInspectingManual] = useState(false);
  const serpBenchmarkRef = useRef<SerpBenchmarkHandle>(null);

  // Load tracked sites
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data?.length) {
          setTrackedSites(data);
          if (!externalSiteId) setSelectedSiteId(data[0].id);
        }
      });
  }, [user, externalSiteId]);

  // Sync with external site selection from console sidebar
  useEffect(() => {
    if (externalSiteId) {
      setSelectedSiteId(externalSiteId);
    }
  }, [externalSiteId]);

  // Load existing checks
  const loadChecks = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-indexation', {
        body: { action: 'list', tracked_site_id: selectedSiteId },
      });
      if (error) throw error;
      setChecks(data?.checks || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => { loadChecks(); }, [loadChecks]);

  // Auto scan key pages
  const handleAutoScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-indexation', {
        body: { action: 'scan-key-pages', tracked_site_id: selectedSiteId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Scan failed');
      
      toast.success(
        t3(language,
          `${data.totalChecked} pages analysées — ${data.indexed} indexées, ${data.notIndexed} problèmes`,
          `${data.totalChecked} pages checked — ${data.indexed} indexed, ${data.notIndexed} issues`,
          `${data.totalChecked} páginas analizadas — ${data.indexed} indexadas, ${data.notIndexed} problemas`
        )
      );
      loadChecks();
      // Auto-trigger SERP benchmark with the domain as keyword
      const domain = trackedSites.find(s => s.id === selectedSiteId)?.domain;
      if (domain && serpBenchmarkRef.current) {
        serpBenchmarkRef.current.triggerBenchmark(domain);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScanning(false);
    }
  };

  // Manual URL inspection — restrict to selected domain
  const handleManualInspect = async () => {
    let url = manualUrl.trim();
    if (!url) return;
    // Auto-prefix with domain if user typed a path
    if (selectedDomain && !url.startsWith('http')) {
      url = `${domainBase}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    // Validate URL belongs to the selected domain
    if (selectedDomain) {
      const normalizedDomain = selectedDomain.replace(/^www\./, '').toLowerCase();
      try {
        const urlDomain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        if (urlDomain !== normalizedDomain) {
          toast.error(t3(language,
            `Seules les URLs du domaine ${normalizedDomain} sont autorisées`,
            `Only URLs from ${normalizedDomain} are allowed`,
            `Solo se permiten URLs del dominio ${normalizedDomain}`
          ));
          return;
        }
      } catch {
        toast.error(t3(language, 'URL invalide', 'Invalid URL', 'URL inválida'));
        return;
      }
    }
    setInspectingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-indexation', {
        body: { action: 'inspect', tracked_site_id: selectedSiteId, urls: [url] },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Inspection failed');

      toast.success(t3(language, 'URL inspectée', 'URL inspected', 'URL inspeccionada'));
      setManualUrl('');
      loadChecks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInspectingManual(false);
    }
  };

  const selectedDomain = externalDomain || trackedSites.find(s => s.id === selectedSiteId)?.domain;
  const domainBase = selectedDomain ? `https://${selectedDomain.replace(/^www\./, '')}` : '';

  const indexed = checks.filter(c => c.verdict === 'PASS').length;
  const notIndexed = checks.filter(c => c.verdict !== 'PASS' && c.verdict !== 'unknown').length;
  const withRichErrors = checks.filter(c => c.rich_results_errors).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                {t3(language, 'Moniteur d\'indexation GSC', 'GSC Indexation Monitor', 'Monitor de Indexación GSC')}
              </CardTitle>
              <CardDescription>
                {t3(language,
                  'Vérifie le statut d\'indexation de vos pages via l\'API Google Search Console',
                  'Check indexation status of your pages via Google Search Console API',
                  'Verifica el estado de indexación de tus páginas vía la API de Google Search Console'
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats summary */}
          {checks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{checks.length}</div>
                <div className="text-xs text-muted-foreground">{t3(language, 'Pages vérifiées', 'Pages checked', 'Páginas verificadas')}</div>
              </div>
              <div className="rounded-lg border p-3 text-center border-emerald-200 bg-emerald-50/50">
                <div className="text-2xl font-bold text-emerald-700">{indexed}</div>
                <div className="text-xs text-emerald-600">{t3(language, 'Indexées', 'Indexed', 'Indexadas')}</div>
              </div>
              <div className="rounded-lg border p-3 text-center border-destructive/30 bg-destructive/5">
                <div className="text-2xl font-bold text-destructive">{notIndexed}</div>
                <div className="text-xs text-destructive/80">{t3(language, 'Non indexées', 'Not indexed', 'No indexadas')}</div>
              </div>
              <div className="rounded-lg border p-3 text-center border-amber-200 bg-amber-50/50">
                <div className="text-2xl font-bold text-amber-700">{withRichErrors}</div>
                <div className="text-xs text-amber-600">{t3(language, 'Erreurs Rich Results', 'Rich Results Errors', 'Errores Rich Results')}</div>
              </div>
            </div>
          )}

          {/* Actions — URL + Type + Analyser */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <Input
                placeholder={inspectMode === 'cible'
                  ? (selectedDomain ? `${domainBase}/page` : t3(language, 'https://example.com/page', 'https://example.com/page', 'https://example.com/pagina'))
                  : (selectedDomain || t3(language, 'Domaine sélectionné', 'Selected domain', 'Dominio seleccionado'))
                }
                value={inspectMode === 'batch' ? '' : manualUrl}
                onChange={e => setManualUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                disabled={inspectMode === 'batch'}
                className="caret-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t3(language, 'Type', 'Type', 'Tipo')}</label>
              <Select value={inspectMode} onValueChange={(v: 'batch' | 'cible') => setInspectMode(v)}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="cible">{t3(language, 'Cible', 'Target', 'Objetivo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={(inspectMode === 'cible' ? inspectingManual : scanning) || (inspectMode === 'cible' && !manualUrl.trim()) || !selectedSiteId}
              className="gap-2 shrink-0"
            >
              {(inspectMode === 'cible' ? inspectingManual : scanning) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t3(language, 'Analyser', 'Analyze', 'Analizar')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : checks.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-center p-3 font-medium">{t3(language, 'Statut', 'Status', 'Estado')}</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">{t3(language, 'Raison', 'Reason', 'Razón')}</th>
                    <th className="text-center p-3 font-medium hidden lg:table-cell">{t3(language, 'Crawlé par', 'Crawled as', 'Crawleado como')}</th>
                    <th className="text-center p-3 font-medium hidden lg:table-cell">{t3(language, 'Dernier crawl', 'Last crawl', 'Último crawl')}</th>
                    <th className="text-center p-3 font-medium hidden md:table-cell">Rich Results</th>
                    <th className="text-center p-3 font-medium">{t3(language, 'Vérifié', 'Checked', 'Verificado')}</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map(check => (
                    <tr key={check.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 max-w-[300px]">
                        <a
                          href={check.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate block"
                          title={check.page_url}
                        >
                          {check.page_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || '/'}
                        </a>
                      </td>
                      <td className="p-3 text-center">{verdictBadge(check.verdict)}</td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {check.coverage_state?.replace(/_/g, ' ') || '—'}
                        </span>
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        <span className="text-xs">{check.crawled_as || '—'}</span>
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {check.last_crawl_time ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-xs flex items-center gap-1 justify-center">
                                <Clock className="h-3 w-3" />
                                {new Date(check.last_crawl_time).toLocaleDateString(language)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{new Date(check.last_crawl_time).toLocaleString(language)}</TooltipContent>
                          </Tooltip>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        {check.rich_results_errors ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {Array.isArray(check.rich_results_errors) ? check.rich_results_errors.length : 1}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-1">
                                {Array.isArray(check.rich_results_errors) && check.rich_results_errors.map((err: any, i: number) => (
                                  <div key={i}>
                                    <strong>{err.richResultType}:</strong>{' '}
                                    {err.issues?.map((issue: any) => issue.message).join(', ')}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="outline" className="text-xs text-emerald-600">OK</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs text-muted-foreground">
                          {new Date(check.checked_at).toLocaleDateString(language)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !loading && selectedSiteId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t3(language,
              'Aucune vérification d\'indexation pour ce site. Lancez un scan ou inspectez une URL.',
              'No indexation checks for this site. Run a scan or inspect a URL.',
              'No hay verificaciones de indexación para este sitio. Ejecuta un escaneo o inspecciona una URL.'
            )}</p>
          </CardContent>
        </Card>
      ) : null}
      {/* SERP Benchmark Multi-Providers */}
      <SerpBenchmark
        ref={serpBenchmarkRef}
        trackedSites={trackedSites.map(s => ({ id: s.id, domain: s.domain }))}
        selectedSiteId={selectedSiteId}
      />
    </div>
  );
}
