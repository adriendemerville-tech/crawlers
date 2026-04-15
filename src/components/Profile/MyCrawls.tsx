import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, ExternalLink, Loader2, RefreshCw, Trash2, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SiteCrawl {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  avg_score: number | null;
  ai_summary: string | null;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
}

const translations = {
  fr: {
    title: 'Audits Multi-Pages',
    description: 'Historique de vos crawls de sites complets',
    empty: 'Aucun audit multi-pages réalisé',
    emptyCta: 'Lancer un audit',
    pages: 'pages',
    score: 'Score moyen',
    credits: 'crédits',
    refresh: 'Actualiser',
    delete: 'Supprimer',
    deleteConfirm: 'Supprimer cet audit ?',
    deleteDescription: 'Cette action est irréversible. Toutes les données de ce crawl seront perdues.',
    cancel: 'Annuler',
    viewReport: 'Voir le rapport',
    statusCompleted: 'Terminé',
    statusRunning: 'En cours',
    statusFailed: 'Échoué',
    statusPending: 'En attente',
    indexRatio: 'Ratio Index / Noindex',
    indexed: 'Indexées',
    noindex: 'Noindex',
  },
  en: {
    title: 'Multi-Page Audits',
    description: 'History of your full site crawls',
    empty: 'No multi-page audits yet',
    emptyCta: 'Start an audit',
    pages: 'pages',
    score: 'Avg Score',
    credits: 'credits',
    refresh: 'Refresh',
    delete: 'Delete',
    deleteConfirm: 'Delete this audit?',
    deleteDescription: 'This action is irreversible. All crawl data will be lost.',
    cancel: 'Cancel',
    viewReport: 'View report',
    statusCompleted: 'Completed',
    statusRunning: 'Running',
    statusFailed: 'Failed',
    statusPending: 'Pending',
    indexRatio: 'Index / Noindex Ratio',
    indexed: 'Indexed',
    noindex: 'Noindex',
  },
  es: {
    title: 'Auditorías Multi-Páginas',
    description: 'Historial de sus rastreos completos de sitios',
    empty: 'Ninguna auditoría multi-páginas realizada',
    emptyCta: 'Iniciar una auditoría',
    pages: 'páginas',
    score: 'Puntuación media',
    credits: 'créditos',
    refresh: 'Actualizar',
    delete: 'Eliminar',
    deleteConfirm: '¿Eliminar esta auditoría?',
    deleteDescription: 'Esta acción es irreversible. Todos los datos del rastreo se perderán.',
    cancel: 'Cancelar',
    viewReport: 'Ver informe',
    statusCompleted: 'Completado',
    statusRunning: 'En curso',
    statusFailed: 'Fallido',
    statusPending: 'Pendiente',
    indexRatio: 'Ratio Index / Noindex',
    indexed: 'Indexadas',
    noindex: 'Noindex',
  },
};

function getScoreColor(score: number) {
  if (score >= 160) return 'text-emerald-500';
  if (score >= 120) return 'text-amber-500';
  return 'text-red-500';
}

function getStatusBadge(status: string, t: typeof translations['fr']) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t.statusCompleted}</Badge>;
    case 'processing':
    case 'crawling':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">{t.statusRunning}</Badge>;
    case 'failed':
    case 'error':
      return <Badge variant="destructive">{t.statusFailed}</Badge>;
    default:
      return <Badge variant="secondary">{t.statusPending}</Badge>;
  }
}

export function MyCrawls({ externalDomain }: { externalDomain?: string | null }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language];

  const [crawls, setCrawls] = useState<SiteCrawl[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SiteCrawl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(externalDomain ?? null);
  const [indexHistory, setIndexHistory] = useState<any[]>([]);

  useEffect(() => {
    if (externalDomain !== undefined && externalDomain !== null) {
      setSelectedDomain(externalDomain);
    }
  }, [externalDomain]);

  const fetchCrawls = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_crawls')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCrawls(data || []);
      if (data && data.length > 0 && !selectedDomain) {
        setSelectedDomain(data[0].domain);
      }
    } catch (error) {
      console.error('Error fetching crawls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrawls();
  }, [user]);

  // Fetch index history for selected domain
  useEffect(() => {
    if (!user || !selectedDomain) return;
    supabase
      .from('crawl_index_history')
      .select('*')
      .eq('domain', selectedDomain)
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: true })
      .limit(20)
      .then(({ data }) => {
        setIndexHistory(data || []);
      });
  }, [user, selectedDomain]);

  // Group crawls by domain
  const domains = useMemo(() => {
    const domainSet = new Set(crawls.map(c => c.domain));
    return Array.from(domainSet);
  }, [crawls]);

  const filteredCrawls = useMemo(() => {
    if (!selectedDomain) return crawls;
    return crawls.filter(c => c.domain === selectedDomain);
  }, [crawls, selectedDomain]);

  // Build chart data from crawl history for this domain (even without crawl_index_history)
  const chartData = useMemo(() => {
    if (indexHistory.length > 0) {
      return indexHistory.map(h => ({
        week: h.week_start_date,
        indexed: h.indexed_count,
        noindex: h.noindex_count,
      }));
    }
    // Fallback: derive from completed crawls for this domain
    return filteredCrawls
      .filter(c => c.status === 'completed')
      .reverse()
      .map(c => ({
        week: new Date(c.created_at).toISOString().slice(0, 10),
        indexed: c.crawled_pages,
        noindex: 0,
      }));
  }, [indexHistory, filteredCrawls]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('site_crawls')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast.success(t.delete + ' ✓');
      setCrawls(prev => prev.filter(c => c.id !== deleteTarget.id));
    } catch (error) {
      console.error('Error deleting crawl:', error);
      toast.error('Erreur');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-purple-500" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCrawls} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : crawls.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">{t.empty}</p>
            <Button onClick={() => navigate('/app/site-crawl')} variant="outline">
              {t.emptyCta}
            </Button>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Vertical domain sidebar */}
            {domains.length > 0 && (
              <div className="flex flex-col gap-1 shrink-0 w-36">
                {domains.map(domain => {
                  const domainCrawls = crawls.filter(c => c.domain === domain);
                  const latestScore = domainCrawls.find(c => c.avg_score)?.avg_score;
                  return (
                    <button
                      key={domain}
                      onClick={() => setSelectedDomain(domain)}
                      className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedDomain === domain
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <span className="text-xs font-medium truncate">
                        {domain.replace(/^www\./, '')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {domainCrawls.length} crawl{domainCrawls.length > 1 ? 's' : ''}
                        {latestScore && <span className={` ml-1 ${getScoreColor(latestScore)}`}>{Math.round(latestScore)}/200</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Index/Noindex weekly chart */}
              {chartData.length > 1 && (
                <Card className="border">
                  <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">{t.indexRatio}</CardTitle>
                    <button
                      onClick={() => {
                        if (!user || !selectedDomain) return;
                        supabase
                          .from('crawl_index_history')
                          .select('*')
                          .eq('domain', selectedDomain)
                          .eq('user_id', user.id)
                          .order('week_start_date', { ascending: true })
                          .limit(20)
                          .then(({ data }) => setIndexHistory(data || []));
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={t.refresh}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </CardHeader>
                  <CardContent className="px-2 pb-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          labelStyle={{ fontWeight: 600 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="indexed" name={t.indexed} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="noindex" name={t.noindex} stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Crawl list */}
              <div className="space-y-3">
                {filteredCrawls.map((crawl) => (
                  <div
                    key={crawl.id}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                      <Bug className="h-5 w-5 text-purple-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{crawl.domain}</p>
                        {getStatusBadge(crawl.status, t)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {crawl.crawled_pages}/{crawl.total_pages} {t.pages}
                        </span>
                        {crawl.avg_score !== null && (
                          <span className={`flex items-center gap-1 font-semibold ${getScoreColor(crawl.avg_score)}`}>
                            <TrendingUp className="h-3 w-3" />
                            {t.score}: {Math.round(crawl.avg_score)}/200
                          </span>
                        )}
                        <span className="text-xs">
                          {new Date(crawl.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {crawl.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/site-crawl?view=${crawl.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {t.viewReport}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(crawl)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteConfirm}</DialogTitle>
            <DialogDescription>{t.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
