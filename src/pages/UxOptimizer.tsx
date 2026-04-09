import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, Info, Smartphone, Type, Target, Eye, MousePointerClick, BarChart3, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { AnnotatedPageView } from '@/components/UxOptimizer/AnnotatedPageView';

interface TrackedSite {
  id: string;
  domain: string;
  business_type: string | null;
  site_name: string;
}

interface CrawledPage {
  url: string;
  title: string | null;
  seo_score: number | null;
}

interface AxisResult {
  score: number;
  verdict: string;
  detail: string;
}

interface Suggestion {
  axis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  current_text?: string;
  suggested_text?: string;
  rationale: string;
}

interface AnalysisResult {
  page_url: string;
  page_intent: string;
  global_score: number;
  axes: Record<string, AxisResult>;
  suggestions: Suggestion[];
  screenshot_url?: string | null;
  screenshot_height?: number | null;
  annotations?: Array<{
    text: string;
    rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
    axis: string;
    priority: string;
  }>;
}

interface SavedAnalysis {
  id: string;
  page_url: string;
  page_intent: string;
  global_score: number;
  axis_scores: Record<string, AxisResult>;
  suggestions: Suggestion[];
  created_at: string;
}

const AXIS_META: Record<string, { label: string; icon: typeof Type; color: string }> = {
  tone: { label: 'Ton', icon: Type, color: 'text-blue-500' },
  cta_pressure: { label: 'Pression CTA', icon: MousePointerClick, color: 'text-orange-500' },
  alignment: { label: 'Alignement', icon: Target, color: 'text-purple-500' },
  readability: { label: 'Lisibilité', icon: Eye, color: 'text-emerald-500' },
  conversion: { label: 'Conversion', icon: BarChart3, color: 'text-red-500' },
  mobile_ux: { label: 'Mobile UX', icon: Smartphone, color: 'text-cyan-500' },
  keyword_usage: { label: 'Mots-clés', icon: Search, color: 'text-amber-500' },
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function UxOptimizer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(searchParams.get('site') || '');
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [selectedPageUrl, setSelectedPageUrl] = useState('');
  const [loadingPages, setLoadingPages] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load sites
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain, business_type, site_name')
        .order('domain');
      setSites((data as TrackedSite[]) || []);
    })();
  }, []);

  // Auto-select site from URL
  useEffect(() => {
    const siteParam = searchParams.get('site');
    if (siteParam && sites.length > 0) {
      setSelectedSiteId(siteParam);
    }
  }, [searchParams, sites]);

  // Load crawled pages when site changes
  useEffect(() => {
    if (!selectedSiteId) { setPages([]); return; }
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;

    setLoadingPages(true);
    setPages([]);
    setSelectedPageUrl('');
    setResult(null);

    (async () => {
      // Get latest completed crawl for this domain
      const { data: crawl } = await supabase
        .from('site_crawls')
        .select('id')
        .eq('domain', site.domain)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (crawl) {
        const { data: crawlPages } = await supabase
          .from('crawl_pages')
          .select('url, title, seo_score')
          .eq('crawl_id', crawl.id)
          .order('url');
        setPages((crawlPages as CrawledPage[]) || []);
      }
      setLoadingPages(false);
    })();

    // Load history
    setLoadingHistory(true);
    supabase
      .from('ux_context_analyses')
      .select('*')
      .eq('tracked_site_id', selectedSiteId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setHistory((data as any as SavedAnalysis[]) || []);
        setLoadingHistory(false);
      });
  }, [selectedSiteId, sites]);

  const handleAnalyze = async () => {
    if (!selectedSiteId || !selectedPageUrl) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-ux-context', {
        body: { tracked_site_id: selectedSiteId, page_url: selectedPageUrl },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      setResult(data as AnalysisResult);
      toast({ title: 'Analyse terminée', description: `Score global : ${data.global_score}/100` });

      // Refresh history
      const { data: hist } = await supabase
        .from('ux_context_analyses')
        .select('*')
        .eq('tracked_site_id', selectedSiteId)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistory((hist as any as SavedAnalysis[]) || []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Analyse échouée', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadSavedAnalysis = (saved: SavedAnalysis) => {
    setResult({
      page_url: saved.page_url,
      page_intent: saved.page_intent,
      global_score: saved.global_score,
      axes: saved.axis_scores,
      suggestions: saved.suggestions,
    });
    setSelectedPageUrl(saved.page_url);
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <Badge variant="destructive" className="text-[10px]">Critique</Badge>;
      case 'high': return <Badge className="bg-orange-500/15 text-orange-600 text-[10px]">Haute</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-[10px]">Moyenne</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Basse</Badge>;
    }
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <>
      <Helmet>
        <title>UX Optimizer | Crawlers</title>
        <meta name="description" content="Analysez l'UX de vos pages en contexte business pour optimiser le ton, les CTA et la conversion." />
      </Helmet>

      <Header />
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/console')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              UX Optimizer
            </h1>
            <p className="text-sm text-muted-foreground">Analyse UX contextuelle de vos pages crawlées</p>
          </div>
        </div>

        {/* Site & Page selector */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Site</label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un site..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Page crawlée</label>
                <Select value={selectedPageUrl} onValueChange={setSelectedPageUrl} disabled={loadingPages || pages.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPages ? 'Chargement...' : pages.length === 0 ? 'Aucune page crawlée' : 'Choisir une page...'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {pages.map(p => (
                      <SelectItem key={p.url} value={p.url}>
                        <span className="truncate max-w-[300px] block">
                          {p.title || p.url}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {pages.length > 0 && `${pages.length} pages crawlées disponibles`}
                {selectedSite && pages.length === 0 && !loadingPages && (
                  <span className="text-amber-500">Aucun crawl trouvé — lancez un crawl d'abord</span>
                )}
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedPageUrl || analyzing}
                className="gap-2"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analyzing ? 'Analyse en cours...' : 'Analyser'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Global score + intent */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Score global UX</p>
                    <p className={`text-4xl font-bold ${scoreColor(result.global_score)}`}>{result.global_score}/100</p>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    Intent : {result.page_intent}
                  </Badge>
                </div>
                <Progress value={result.global_score} className="h-2" />
              </CardContent>
            </Card>

            {/* 7 Axes grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.entries(result.axes).map(([key, axis]) => {
                const meta = AXIS_META[key];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Card key={key} className="relative overflow-hidden">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="text-sm font-medium">{meta.label}</span>
                        <span className={`ml-auto text-lg font-bold ${scoreColor(axis.score)}`}>{axis.score}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground/80 mb-1">{axis.verdict}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{axis.detail}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Annotated Page View */}
            {result.screenshot_url && (
              <AnnotatedPageView
                screenshotUrl={result.screenshot_url}
                screenshotHeight={result.screenshot_height || 3000}
                annotations={result.annotations || []}
                suggestions={result.suggestions}
                onSelectSuggestion={(idx) => {
                  // Scroll to the suggestion in the list below
                  const el = document.getElementById(`suggestion-${idx}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            )}

            {/* Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Suggestions d'amélioration</CardTitle>
                <CardDescription>{result.suggestions.length} suggestions identifiées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...result.suggestions]
                    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                    .map((s, i) => {
                      const meta = AXIS_META[s.axis];
                      return (
                        <div key={i} className="border border-border/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {priorityBadge(s.priority)}
                            {meta && <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>}
                            <span className="text-sm font-medium">{s.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.rationale}</p>
                          {s.current_text && s.suggested_text && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                                <p className="text-[10px] font-medium text-red-500 mb-1">Actuel</p>
                                <p className="text-xs">{s.current_text}</p>
                              </div>
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                                <p className="text-[10px] font-medium text-emerald-500 mb-1">Suggéré</p>
                                <p className="text-xs">{s.suggested_text}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Analyses précédentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadSavedAnalysis(h)}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{h.page_url}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString('fr-FR')} — {h.page_intent}
                      </p>
                    </div>
                    <span className={`text-lg font-bold ml-3 ${scoreColor(h.global_score)}`}>
                      {h.global_score}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
