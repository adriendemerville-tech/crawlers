import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Spider, Search, BarChart3, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Loader2, Globe, FileText, Image, Link2, Code2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getCreditCost(pages: number) {
  if (pages <= 50) return 5;
  if (pages <= 100) return 10;
  if (pages <= 200) return 15;
  return 30;
}

function getScoreColor(score: number) {
  if (score >= 160) return 'text-emerald-500';
  if (score >= 120) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number) {
  if (score >= 160) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 120) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

interface CrawlPage {
  id: string;
  url: string;
  path: string;
  http_status: number | null;
  title: string | null;
  h1: string | null;
  seo_score: number | null;
  word_count: number;
  images_without_alt: number;
  has_schema_org: boolean;
  has_canonical: boolean;
  has_og: boolean;
  issues: string[];
}

interface CrawlResult {
  id: string;
  domain: string;
  url: string;
  status: string;
  total_pages: number;
  crawled_pages: number;
  avg_score: number | null;
  ai_summary: string | null;
  ai_recommendations: any[];
  created_at: string;
  completed_at: string | null;
}

export default function SiteCrawl() {
  const { user } = useAuth();
  const { credits } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score_asc' | 'score_desc' | 'path'>('score_asc');
  const [pastCrawls, setPastCrawls] = useState<CrawlResult[]>([]);
  const [viewingCrawlId, setViewingCrawlId] = useState<string | null>(null);

  const creditCost = getCreditCost(maxPages);

  // Load past crawls
  useEffect(() => {
    if (!user) return;
    supabase
      .from('site_crawls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setPastCrawls(data as any);
      });
  }, [user, crawlResult]);

  // Poll progress while crawling
  useEffect(() => {
    if (!crawlResult || crawlResult.status === 'completed' || crawlResult.status === 'error') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('site_crawls')
        .select('*')
        .eq('id', crawlResult.id)
        .single();
      if (data) {
        const r = data as any;
        setCrawlResult(r);
        if (r.total_pages > 0) setProgress(Math.round((r.crawled_pages / r.total_pages) * 100));
        if (r.status === 'analyzing') setPhase('Synthèse IA en cours…');
        if (r.status === 'completed' || r.status === 'error') {
          clearInterval(interval);
          loadPages(r.id);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [crawlResult]);

  async function loadPages(crawlId: string) {
    const { data } = await supabase
      .from('crawl_pages')
      .select('*')
      .eq('crawl_id', crawlId)
      .order('seo_score', { ascending: true });
    if (data) setPages(data as any);
  }

  async function viewCrawl(crawl: CrawlResult) {
    setCrawlResult(crawl);
    setViewingCrawlId(crawl.id);
    await loadPages(crawl.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (credits < creditCost) {
      toast.error(`Crédits insuffisants. Requis : ${creditCost}, disponibles : ${credits}`);
      return;
    }

    setIsLoading(true);
    setPhase('Mapping du site…');
    setProgress(0);
    setPages([]);
    setCrawlResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('crawl-site', {
        body: { url, maxPages, userId: user.id },
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'Erreur lors du crawl');
        setIsLoading(false);
        return;
      }

      // Load full result from DB
      const { data: crawl } = await supabase
        .from('site_crawls')
        .select('*')
        .eq('id', data.crawlId)
        .single();

      if (crawl) {
        setCrawlResult(crawl as any);
        await loadPages(data.crawlId);
      }

      toast.success(`Crawl terminé : ${data.totalPages} pages analysées`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur inattendue');
    } finally {
      setIsLoading(false);
      setPhase('');
    }
  }

  const sortedPages = [...pages].sort((a, b) => {
    if (sortBy === 'score_asc') return (a.seo_score || 0) - (b.seo_score || 0);
    if (sortBy === 'score_desc') return (b.seo_score || 0) - (a.seo_score || 0);
    return a.path.localeCompare(b.path);
  });

  const issueStats = pages.reduce<Record<string, number>>((acc, p) => {
    (p.issues || []).forEach((issue: string) => {
      acc[issue] = (acc[issue] || 0) + 1;
    });
    return acc;
  }, {});

  return (
    <>
      <Helmet>
        <title>Crawl Multi-Pages SEO — Analysez votre site complet | Crawlers.fr</title>
        <meta name="description" content="Analysez toutes les pages de votre site en un clic. Score SEO/200 par page, détection d'erreurs, synthèse IA globale." />
      </Helmet>
      <Header />

      <main className="min-h-screen bg-background pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Spider className="w-4 h-4" />
              Crawl Multi-Pages
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Auditez votre site <span className="text-primary">page par page</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Crawl complet avec score SEO/200 par page, détection d'erreurs techniques et synthèse IA globale.
            </p>
          </div>

          {/* Formulaire */}
          <Card className="mb-8 border-primary/20">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://votre-site.fr"
                      className="pl-10"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" disabled={isLoading || !url} className="gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {isLoading ? phase || 'Crawl en cours…' : 'Lancer le crawl'}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center justify-between">
                      <span>Pages à analyser</span>
                      <span className="font-semibold text-foreground">{maxPages}</span>
                    </label>
                    <Slider
                      value={[maxPages]}
                      onValueChange={v => setMaxPages(v[0])}
                      min={10}
                      max={200}
                      step={10}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border">
                    <CreditCoin size={20} />
                    <span className="text-sm font-semibold">{creditCost} crédits</span>
                  </div>
                </div>
              </form>

              {isLoading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{phase}</span>
                    <span className="font-mono text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Résultats */}
          {crawlResult && crawlResult.status === 'completed' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Métriques globales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{crawlResult.crawled_pages}</div>
                    <div className="text-xs text-muted-foreground mt-1">Pages analysées</div>
                  </CardContent>
                </Card>
                <Card className={`border ${getScoreBg(crawlResult.avg_score || 0)}`}>
                  <CardContent className="p-4 text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(crawlResult.avg_score || 0)}`}>
                      {crawlResult.avg_score}/200
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Score moyen</div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {pages.filter(p => (p.issues || []).length === 0).length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Pages parfaites</div>
                  </CardContent>
                </Card>
                <Card className="border border-destructive/20 bg-destructive/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-destructive">
                      {Object.values(issueStats).reduce((s, v) => s + v, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Erreurs totales</div>
                  </CardContent>
                </Card>
              </div>

              {/* Synthèse IA */}
              {crawlResult.ai_summary && (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Synthèse IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground leading-relaxed">{crawlResult.ai_summary}</p>

                    {crawlResult.ai_recommendations?.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Recommandations prioritaires</h4>
                        {(crawlResult.ai_recommendations as any[]).map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Badge variant={rec.priority === 'critical' ? 'destructive' : rec.priority === 'high' ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                              {rec.priority}
                            </Badge>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">{rec.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{rec.description}</div>
                              {rec.affected_pages && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  📄 {rec.affected_pages} pages concernées
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Top erreurs */}
              {Object.keys(issueStats).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      Erreurs les plus fréquentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(issueStats)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([issue, count]) => (
                          <div key={issue} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                            <span className="text-sm text-foreground font-mono">{issue.replace(/_/g, ' ')}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Liste des pages */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      Pages crawlées ({pages.length})
                    </CardTitle>
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score_asc">Score ↑ (pires d'abord)</SelectItem>
                        <SelectItem value="score_desc">Score ↓ (meilleurs)</SelectItem>
                        <SelectItem value="path">Chemin A→Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {sortedPages.map(page => (
                      <div key={page.id} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => setExpandedPage(expandedPage === page.id ? null : page.id)}
                        >
                          <div className={`text-sm font-bold tabular-nums w-16 shrink-0 ${getScoreColor(page.seo_score || 0)}`}>
                            {page.seo_score}/200
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate font-medium">{page.path}</div>
                            <div className="text-xs text-muted-foreground truncate">{page.title || '(sans titre)'}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(page.issues || []).length > 0 && (
                              <Badge variant="destructive" className="text-xs">{(page.issues || []).length}</Badge>
                            )}
                            {(page.issues || []).length === 0 && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            {expandedPage === page.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {expandedPage === page.id && (
                          <div className="px-4 pb-3 pt-1 border-t bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">H1:</span>
                                <span className="text-foreground truncate">{page.h1 || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Mots:</span>
                                <span className="text-foreground">{page.word_count}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Image className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Imgs sans alt:</span>
                                <span className={page.images_without_alt > 0 ? 'text-destructive' : 'text-emerald-500'}>{page.images_without_alt}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Status:</span>
                                <span className={page.http_status === 200 ? 'text-emerald-500' : 'text-destructive'}>{page.http_status}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {page.has_schema_org && <Badge variant="secondary" className="text-[10px]">Schema.org ✓</Badge>}
                              {page.has_canonical && <Badge variant="secondary" className="text-[10px]">Canonical ✓</Badge>}
                              {page.has_og && <Badge variant="secondary" className="text-[10px]">OpenGraph ✓</Badge>}
                              {!page.has_schema_org && <Badge variant="destructive" className="text-[10px]">Schema.org ✗</Badge>}
                              {!page.has_canonical && <Badge variant="destructive" className="text-[10px]">Canonical ✗</Badge>}
                              {!page.has_og && <Badge variant="destructive" className="text-[10px]">OG ✗</Badge>}
                            </div>
                            {(page.issues || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(page.issues as string[]).map((issue, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">
                                    {issue.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Crawls précédents */}
          {!crawlResult && pastCrawls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Crawls précédents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastCrawls.map(c => (
                    <button
                      key={c.id}
                      onClick={() => viewCrawl(c)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.domain}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString('fr-FR')} · {c.crawled_pages} pages
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.avg_score && (
                          <span className={`text-sm font-bold ${getScoreColor(c.avg_score)}`}>{c.avg_score}/200</span>
                        )}
                        <Badge variant={c.status === 'completed' ? 'default' : c.status === 'error' ? 'destructive' : 'secondary'}>
                          {c.status}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
