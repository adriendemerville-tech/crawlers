import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2, Info, Smartphone, Type, Target, Eye, MousePointerClick, BarChart3, Search, ImageIcon, PenTool, Trash2, FileText, Euro, RefreshCw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { AnnotatedPageView } from '@/components/ConversionOptimizer/AnnotatedPageView';
import { ProAccessGate } from '@/components/ProAccessGate';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import type { ManualAnnotation } from '@/components/ConversionOptimizer/ManualAnnotationOverlay';

const CocoonContentArchitectModal = lazy(() =>
  import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal }))
);
const CROReportPreviewModal = lazy(() =>
  import('@/components/ConversionOptimizer/CROReportPreviewModal').then(m => ({ default: m.CROReportPreviewModal }))
);

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

interface ImageFormatDetail {
  src: string;
  format: string;
  is_optimized: boolean;
  dimensions: string;
  alt: string;
}

interface ImageFormatReport {
  total: number;
  unoptimized: number;
  optimized: number;
  details: ImageFormatDetail[];
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
    suggestionIndex?: number;
  }>;
  image_format_report?: ImageFormatReport;
  image_analysis?: ImageAnalysis[];
  indexation_status?: {
    is_indexable: boolean;
    is_indexed: boolean;
    gsc_verdict: string | null;
    gsc_coverage_state: string | null;
    gsc_checked_at: string | null;
    has_noindex: boolean;
    canonical_mismatch: string | null;
    warnings: string[];
  };
}

interface ImageAnalysis {
  src: string;
  descriptiveness: number;
  relevance: number;
  persuasiveness: number;
  verdict: string;
  recommendation?: string;
}

interface SavedAnalysis {
  id: string;
  page_url: string;
  page_intent: string;
  global_score: number;
  axis_scores: Record<string, AxisResult>;
  suggestions: Suggestion[];
  screenshot_url?: string | null;
  screenshot_height?: number | null;
  annotations?: Array<{
    text: string;
    rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
    axis: string;
    priority: string;
    suggestionIndex?: number;
  }>;
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
  chunkability: { label: 'Chunkability IA', icon: PenTool, color: 'text-indigo-500' },
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function ConversionOptimizer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();

  // Pro access check
  const hasAccess = isAdmin || ['agency_pro', 'agency_premium'].includes(profile?.plan_type || '');

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(searchParams.get('site') || '');
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [selectedPageUrl, setSelectedPageUrl] = useState('');
  const [loadingPages, setLoadingPages] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [backfillingAnnotations, setBackfillingAnnotations] = useState(false);
  const [showContentArchitect, setShowContentArchitect] = useState(false);
  const [freshAnalysis, setFreshAnalysis] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [manualAnnotations, setManualAnnotations] = useState<ManualAnnotation[]>([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const fetchHistory = async (siteId: string) => {
    if (!siteId) {
      setHistory([]);
      return;
    }

    setLoadingHistory(true);
    const { data } = await supabase
      .from('ux_context_analyses')
      .select('*')
      .eq('tracked_site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(10);

    setHistory((data as any as SavedAnalysis[]) || []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain, business_type, site_name')
        .order('domain');
      setSites((data as TrackedSite[]) || []);
    })();
  }, []);

  useEffect(() => {
    const siteParam = searchParams.get('site');
    if (siteParam && sites.length > 0) {
      setSelectedSiteId(siteParam);
    }
  }, [searchParams, sites]);

  useEffect(() => {
    if (!selectedSiteId) {
      setPages([]);
      setHistory([]);
      return;
    }

    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;

    setLoadingPages(true);
    setPages([]);
    setSelectedPageUrl('');
    setResult(null);
    setFreshAnalysis(false);
    setBackfillingAnnotations(false);

    (async () => {
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

    void fetchHistory(selectedSiteId);
  }, [selectedSiteId, sites]);

  const handleAnalyze = async () => {
    if (!selectedSiteId || !selectedPageUrl) return;
    setAnalyzing(true);
    setResult(null);
    setBackfillingAnnotations(false);
    setManualAnnotations([]);
    setDrawingMode(false);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-ux-context', {
        body: { tracked_site_id: selectedSiteId, page_url: selectedPageUrl },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      setResult(data as AnalysisResult);
      setFreshAnalysis(true);
      toast({ title: 'Analyse terminée', description: `Score global : ${data.global_score}/100` });
      await fetchHistory(selectedSiteId);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Analyse échouée', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRecalculate = useCallback(async () => {
    if (!selectedSiteId || !selectedPageUrl || manualAnnotations.length === 0) return;
    setRecalculating(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-ux-context', {
        body: {
          tracked_site_id: selectedSiteId,
          page_url: selectedPageUrl,
          mode: 'manual-suggestions',
          manual_annotations: manualAnnotations,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Recalculation failed');

      const newSuggestions = data.suggestions || [];
      setResult((current) => current ? {
        ...current,
        suggestions: [...current.suggestions, ...newSuggestions],
      } : current);

      setDrawingMode(false);
      toast({
        title: 'Suggestions ajoutées',
        description: `${newSuggestions.length} nouvelles recommandations générées.${data.workbench_injected > 0 ? ` ${data.workbench_injected} envoyées au Workbench.` : ''}`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Recalcul échoué', variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  }, [selectedSiteId, selectedPageUrl, manualAnnotations, toast]);

  const hydrateSavedAnalysisAnnotations = async (saved: SavedAnalysis) => {
    if (!selectedSiteId || !saved.screenshot_url || (saved.annotations?.length ?? 0) > 0) return;

    setBackfillingAnnotations(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-ux-context', {
        body: {
          tracked_site_id: selectedSiteId,
          page_url: saved.page_url,
          mode: 'annotations-only',
          analysis_id: saved.id,
          suggestions: saved.suggestions,
        },
      });

      if (error) throw error;

      const nextAnnotations = data?.annotations || [];

      if (nextAnnotations.length === 0) {
        toast({
          title: 'Repères visuels introuvables',
          description: 'Cet ancien audit n’avait pas de coordonnées enregistrées pour tracer les bulles.',
          variant: 'destructive',
        });
        return;
      }

      setResult((current) => current ? { ...current, annotations: nextAnnotations } : current);
      setHistory((current) => current.map((item) => (
        item.id === saved.id ? { ...item, annotations: nextAnnotations } : item
      )));

      toast({
        title: 'Vue annotée restaurée',
        description: `${nextAnnotations.length} repères visuels recalculés sur cette capture.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || 'Impossible de recalculer les annotations de cet audit.',
        variant: 'destructive',
      });
    } finally {
      setBackfillingAnnotations(false);
    }
  };

  const loadSavedAnalysis = async (saved: SavedAnalysis) => {
    setFreshAnalysis(false);
    setResult({
      page_url: saved.page_url,
      page_intent: saved.page_intent,
      global_score: saved.global_score,
      axes: saved.axis_scores,
      suggestions: saved.suggestions,
      screenshot_url: saved.screenshot_url,
      screenshot_height: saved.screenshot_height,
      annotations: saved.annotations,
    });
    setSelectedPageUrl(saved.page_url);

    if (!saved.annotations?.length) {
      await hydrateSavedAnalysisAnnotations(saved);
    }
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
        <title>Conversion Optimizer | Crawlers</title>
        <meta name="description" content="Analysez l'UX de vos pages en contexte business pour optimiser le ton, les CTA et la conversion." />
      </Helmet>

      <Header />
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/console')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="relative inline-flex items-center justify-center h-7 w-7">
                <TrendingUp className="h-6 w-6 text-emerald-700" />
                <Euro className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 text-emerald-600" />
              </span>
              Conversion Optimizer
            </h1>
            <p className="text-sm text-muted-foreground">Analyse UX contextuelle de vos pages crawlées</p>
          </div>
        </div>

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

            {selectedSite && pages.length === 0 && !loadingPages && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-500">
                  Aucun crawl trouvé pour ce site. Lancez un crawl et un audit complet avant d'utiliser le Conversion Optimizer.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {pages.length > 0 && `${pages.length} pages crawlées disponibles`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleAnalyze}
                  disabled={!selectedPageUrl || analyzing}
                  className="gap-2 bg-transparent text-white border-white hover:bg-white/10 hover:text-white"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  {analyzing ? 'Analyse en cours...' : 'Analyser'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReport(true)}
                  disabled={!result}
                  className="gap-2 bg-transparent text-white border-white hover:bg-white/10 hover:text-white"
                >
                  <FileText className="h-4 w-4" />
                  Rapport
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowContentArchitect(true)}
                  disabled={!freshAnalysis || analyzing}
                  className={`gap-2 transition-all ${freshAnalysis && !analyzing
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-transparent text-white/40 border-white/20 cursor-not-allowed'}`}
                >
                  <PenTool className="h-4 w-4" />
                  Optimiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && (
           <div className="space-y-4">
            {result.indexation_status && result.indexation_status.warnings.length > 0 && (
              <Card className={`border-l-4 ${result.indexation_status.is_indexable && result.indexation_status.is_indexed ? 'border-l-yellow-500' : 'border-l-destructive'}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${result.indexation_status.is_indexable && result.indexation_status.is_indexed ? 'text-yellow-500' : 'text-destructive'}`} />
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {!result.indexation_status.is_indexable ? 'Page non indexable' : !result.indexation_status.is_indexed ? 'Page non indexée' : 'Avertissements d\'indexation'}
                      </p>
                      {result.indexation_status.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{w}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {result.indexation_status && result.indexation_status.is_indexable && result.indexation_status.is_indexed && result.indexation_status.warnings.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Page indexable et indexée par Google</span>
              </div>
            )}
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

            {result.image_format_report && result.image_format_report.unoptimized > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-amber-500" />
                    Formats d'images non optimisés
                  </CardTitle>
                  <CardDescription>
                    {result.image_format_report.unoptimized} image{result.image_format_report.unoptimized > 1 ? 's' : ''} sur {result.image_format_report.total} utilisent un format non optimal (JPG, PNG, GIF). 
                    Convertissez-les en <strong>WebP</strong> ou <strong>AVIF</strong> pour réduire le temps de chargement de 25 à 80%.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {result.image_format_report.details
                      .filter(img => !img.is_optimized)
                      .map((img, i) => {
                        const filename = img.src.split('/').pop()?.split('?')[0] || img.src;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-background/50">
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30 uppercase text-[10px] font-mono">
                              {img.format}
                            </Badge>
                            <span className="truncate flex-1 text-muted-foreground" title={img.src}>
                              {filename}
                            </span>
                            <span className="text-muted-foreground/60 shrink-0">{img.dimensions}</span>
                            <span className="text-emerald-600 shrink-0">→ WebP</span>
                          </div>
                        );
                      })}
                  </div>
                  {result.image_format_report.optimized > 0 && (
                    <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {result.image_format_report.optimized} image{result.image_format_report.optimized > 1 ? 's' : ''} déjà optimisée{result.image_format_report.optimized > 1 ? 's' : ''} (WebP/AVIF/SVG)
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {result.image_format_report && result.image_format_report.unoptimized === 0 && result.image_format_report.total > 0 && (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Toutes les {result.image_format_report.total} images utilisent des formats optimisés (WebP, AVIF, SVG)
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-violet-500" />
                  Analyse qualitative des images {result.image_analysis && result.image_analysis.length > 0 ? `(${result.image_analysis.length})` : ''}
                </CardTitle>
                <CardDescription>
                  Évaluation de la descriptivité, pertinence et pouvoir de conviction de chaque image
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.image_analysis && result.image_analysis.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {result.image_analysis.map((img, i) => {
                      const avgScore = Math.round((img.descriptiveness + img.relevance + img.persuasiveness) / 3);
                      const scoreClr = avgScore >= 70 ? 'text-emerald-600' : avgScore >= 40 ? 'text-amber-600' : 'text-red-500';
                      const fileName = img.src.split('/').pop()?.split('?')[0] || img.src;
                      return (
                        <div key={i} className="border border-border/40 rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-mono text-muted-foreground truncate flex-1" title={img.src}>{fileName}</p>
                            <span className={`text-sm font-bold ${scoreClr}`}>{avgScore}/100</span>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-muted-foreground">Descriptif</span>
                              <span className="font-semibold">{img.descriptiveness}</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-muted-foreground">Pertinence</span>
                              <span className="font-semibold">{img.relevance}</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-muted-foreground">Conviction</span>
                              <span className="font-semibold">{img.persuasiveness}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{img.verdict}</p>
                          {img.recommendation && (
                            <p className="text-xs text-violet-500 flex items-start gap-1">
                              <Info className="h-3 w-3 mt-0.5 shrink-0" />
                              {img.recommendation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    Aucune image significative détectée sur cette page, ou l'IA n'a pas retourné d'analyse d'images pour cet audit.
                  </p>
                )}
              </CardContent>
            </Card>

            {result.screenshot_url && (
              <div className="space-y-2">
                {backfillingAnnotations && (
                  <p className="text-xs text-muted-foreground">Repositionnement des bulles et des traits en cours sur cet audit…</p>
                )}
                <AnnotatedPageView
                  screenshotUrl={result.screenshot_url}
                  screenshotHeight={result.screenshot_height || 3000}
                  annotations={result.annotations || []}
                  suggestions={result.suggestions}
                  onSelectSuggestion={(idx) => {
                    const el = document.getElementById(`suggestion-${idx}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  manualAnnotations={manualAnnotations}
                  onManualAnnotationsChange={setManualAnnotations}
                  drawingMode={drawingMode}
                  onDrawingModeChange={setDrawingMode}
                />
                {manualAnnotations.length > 0 && (
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setManualAnnotations([]); setDrawingMode(false); }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Effacer les annotations
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleRecalculate}
                      disabled={recalculating}
                    >
                      {recalculating ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Calcul en cours…</>
                      ) : (
                        <><RefreshCw className="h-3 w-3 mr-1" /> Recalculer ({manualAnnotations.length} annotation{manualAnnotations.length > 1 ? 's' : ''})</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

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
                        <div key={i} id={`suggestion-${i}`} className="border border-border/50 rounded-lg p-3 space-y-2 scroll-mt-20">
                          <div className="flex items-center gap-2 flex-wrap">
                            {priorityBadge(s.priority)}
                            {meta && <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>}
                            {(s as any).is_manual && <Badge className="bg-cyan-500/15 text-cyan-600 text-[10px]">Manuel</Badge>}
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

        {history.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Analyses précédentes</CardTitle>
              {loadingHistory && <CardDescription>Actualisation de l'historique…</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map(h => (
                  <div
                    key={h.id}
                    className="group relative w-full flex items-center py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/30 cursor-pointer"
                    onClick={() => void loadSavedAnalysis(h)}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm truncate">{h.page_url}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString('fr-FR')} — {h.page_intent}
                      </p>
                    </div>
                    <span className={`text-lg font-bold shrink-0 ${scoreColor(h.global_score)}`}>
                      {h.global_score}
                    </span>
                    <button
                      className="shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive self-center"
                      title="Supprimer"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await supabase.from('ux_context_analyses').delete().eq('id', h.id);
                        setHistory(prev => prev.filter(x => x.id !== h.id));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showContentArchitect && result && (
        <Suspense fallback={null}>
          <CocoonContentArchitectModal
            isOpen={showContentArchitect}
            onClose={() => setShowContentArchitect(false)}
            nodes={[]}
            domain={selectedSite?.domain}
            trackedSiteId={selectedSiteId}
            prefillUrl={result.page_url}
            prefillPrompt={
              `Optimisation CRO issue du Conversion Optimizer (score ${result.global_score}/100).\n\n` +
              `Objectif : appliquer les corrections suivantes sur la page :\n\n` +
              result.suggestions
                .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                .map((s, i) => `${i + 1}. [${s.priority.toUpperCase()}] ${s.title} — ${s.rationale}${s.suggested_text ? `\n   → Texte suggéré : "${s.suggested_text}"` : ''}`)
                .join('\n\n')
            }
            isExistingPage={true}
            colorTheme="green"
          />
        </Suspense>
      )}
      {showReport && result && (
        <Suspense fallback={null}>
          <CROReportPreviewModal
            isOpen={showReport}
            onClose={() => setShowReport(false)}
            data={result}
            domain={selectedSite?.domain || ''}
          />
        </Suspense>
      )}
    </>
  );
}
