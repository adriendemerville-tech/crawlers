import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Globe, FileText, DollarSign, TrendingUp, Square, Bug, RotateCcw,
  Loader2, RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { CrawlPagesStatsCard } from './CrawlPagesStatsCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface CrawlRow {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
  avg_score: number | null;
  error_message: string | null;
  user_id: string;
}

const COST_PER_PAGE = 0.002; // estimated cost per page (Firecrawl)
const REVENUE_PER_CREDIT = 0.10; // revenue per credit charged

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'En attente', icon: <Clock className="h-3 w-3" />, variant: 'outline' },
  processing: { label: 'En cours', icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: 'default' },
  completed: { label: 'Terminé', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'secondary' },
  failed: { label: 'Échoué', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
  cancelled: { label: 'Annulé', icon: <AlertTriangle className="h-3 w-3" />, variant: 'outline' },
};

export function CrawlManagement() {
  const [crawls, setCrawls] = useState<CrawlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [debugCrawlId, setDebugCrawlId] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any>(null);

  const fetchCrawls = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_crawls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) setCrawls(data as CrawlRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchCrawls(); }, []);

  // Stats
  const totalPages = crawls.reduce((s, c) => s + c.crawled_pages, 0);
  const totalCreditsUsed = crawls.reduce((s, c) => s + c.credits_used, 0);
  const estimatedCost = totalPages * COST_PER_PAGE;
  const estimatedRevenue = totalCreditsUsed * REVENUE_PER_CREDIT;
  const activeCrawls = crawls.filter(c => c.status === 'processing' || c.status === 'pending');

  const handleStop = async (crawl: CrawlRow) => {
    setActionLoading(crawl.id);
    // Stop the crawl by marking it completed/cancelled
    const { error } = await supabase
      .from('site_crawls')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', crawl.id);

    // Also cancel any pending crawl_jobs
    await supabase
      .from('crawl_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('crawl_id', crawl.id)
      .in('status', ['pending', 'processing']);

    if (error) {
      toast.error('Erreur lors de l\'arrêt du crawl');
    } else {
      toast.success(`Crawl ${crawl.domain} arrêté`);
      fetchCrawls();
    }
    setActionLoading(null);
  };

  const handleDebug = async (crawl: CrawlRow) => {
    setDebugCrawlId(debugCrawlId === crawl.id ? null : crawl.id);
    if (debugCrawlId === crawl.id) {
      setDebugData(null);
      return;
    }

    // Fetch crawl_jobs and crawl_pages count
    const [jobsRes, pagesRes] = await Promise.all([
      supabase.from('crawl_jobs').select('*').eq('crawl_id', crawl.id),
      supabase.from('crawl_pages').select('id, url, seo_score, http_status, issues', { count: 'exact' }).eq('crawl_id', crawl.id).limit(10),
    ]);

    setDebugData({
      crawl,
      jobs: jobsRes.data || [],
      pages_count: pagesRes.count || 0,
      pages_sample: pagesRes.data || [],
    });
  };

  const handleRestart = async (crawl: CrawlRow) => {
    setActionLoading(crawl.id);

    // Reset the crawl status
    const { error } = await supabase
      .from('site_crawls')
      .update({ status: 'pending', completed_at: null, error_message: null })
      .eq('id', crawl.id);

    if (error) {
      toast.error('Erreur lors de la relance');
      setActionLoading(null);
      return;
    }

    // Reset associated crawl_jobs
    await supabase
      .from('crawl_jobs')
      .update({ status: 'pending', started_at: null, completed_at: null, error_message: null })
      .eq('crawl_id', crawl.id)
      .in('status', ['failed', 'cancelled']);

    // Trigger the queue processor
    try {
      await supabase.functions.invoke('process-crawl-queue');
    } catch {}

    toast.success(`Crawl ${crawl.domain} relancé`);
    fetchCrawls();
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pages crawlées</p>
              <p className="text-xl font-bold">{totalPages.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <DollarSign className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coût estimé</p>
              <p className="text-xl font-bold">{estimatedCost.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenu crédits</p>
              <p className="text-xl font-bold">{estimatedRevenue.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Globe className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Crawls actifs</p>
              <p className="text-xl font-bold">{activeCrawls.length}</p>
            </div>
          </CardContent>
        </Card>
    </div>

      {/* Pages per crawl stats */}
      <CrawlPagesStatsCard />

      {/* Crawls Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Tous les crawls</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchCrawls} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Domaine</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Progression</TableHead>
                    <TableHead className="text-xs text-right">Pages</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">Crédits</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">Score moy.</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crawls.map((crawl) => {
                    const progress = crawl.total_pages > 0
                      ? Math.round((crawl.crawled_pages / crawl.total_pages) * 100)
                      : 0;
                    const cfg = statusConfig[crawl.status] || statusConfig.pending;
                    const isActive = crawl.status === 'processing' || crawl.status === 'pending';

                    return (
                      <>
                        <TableRow key={crawl.id} className={debugCrawlId === crawl.id ? 'bg-muted/50' : ''}>
                          <TableCell className="font-medium max-w-[120px] sm:max-w-[200px] truncate text-xs">{crawl.domain}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="gap-1 text-[10px] sm:text-xs">
                              {cfg.icon} <span className="hidden sm:inline">{cfg.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[120px] hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {crawl.crawled_pages}/{crawl.total_pages}
                          </TableCell>
                          <TableCell className="text-right text-xs hidden sm:table-cell">{crawl.credits_used}</TableCell>
                          <TableCell className="text-right text-xs hidden sm:table-cell">
                            {crawl.avg_score ? `${Math.round(Number(crawl.avg_score))}/200` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                            {new Date(crawl.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              {isActive && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleStop(crawl)}
                                  disabled={actionLoading === crawl.id}
                                  title="Arrêter"
                                >
                                  {actionLoading === crawl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDebug(crawl)}
                                title="Debug"
                              >
                                <Bug className="h-3 w-3" />
                              </Button>
                              {(crawl.status === 'failed' || crawl.status === 'cancelled' || (crawl.status === 'processing' && crawl.crawled_pages < crawl.total_pages)) && (
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRestart(crawl)}
                                  disabled={actionLoading === crawl.id}
                                  title="Relancer"
                                >
                                  {actionLoading === crawl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Debug panel */}
                        {debugCrawlId === crawl.id && debugData && (
                          <TableRow key={`debug-${crawl.id}`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
                              <div className="space-y-3 text-sm">
                                <div className="font-semibold flex items-center gap-2">
                                  <Bug className="h-4 w-4" /> Debug — {crawl.domain}
                                </div>
                                
                                {crawl.error_message && (
                                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs font-mono">
                                    {crawl.error_message}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Crawl ID:</span>
                                    <p className="font-mono truncate">{crawl.id}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">User ID:</span>
                                    <p className="font-mono truncate">{crawl.user_id}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Jobs liés:</span>
                                    <p>{debugData.jobs.length}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Pages en base:</span>
                                    <p>{debugData.pages_count}</p>
                                  </div>
                                </div>

                                {debugData.jobs.length > 0 && (
                                  <div>
                                    <p className="font-medium mb-1">Jobs:</p>
                                    <div className="space-y-1">
                                      {debugData.jobs.map((job: any) => (
                                        <div key={job.id} className="flex items-center gap-2 text-xs bg-background rounded p-2">
                                          <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
                                          <span>Processed: {job.processed_count}/{job.total_count}</span>
                                          {job.error_message && (
                                            <span className="text-destructive truncate max-w-[300px]">{job.error_message}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {debugData.pages_sample.length > 0 && (
                                  <div>
                                    <p className="font-medium mb-1">Échantillon pages ({debugData.pages_count} total):</p>
                                    <div className="space-y-1">
                                      {debugData.pages_sample.map((page: any) => (
                                        <div key={page.id} className="flex items-center gap-2 text-xs bg-background rounded p-2">
                                          <span className={`font-mono ${page.http_status === 200 ? 'text-green-500' : 'text-red-500'}`}>
                                            {page.http_status || '?'}
                                          </span>
                                          <span className="truncate flex-1">{page.url}</span>
                                          <span className="text-muted-foreground">Score: {page.seo_score || '—'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {crawls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun crawl trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
