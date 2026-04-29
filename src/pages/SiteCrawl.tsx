import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Bug, Search, BarChart3, AlertTriangle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2, Globe, FileText, Image, Link2, Code2, ChevronDown, ChevronUp, Sparkles, TrendingUp, Settings2, Download, GitCompare, Filter, Layers, Plus, Trash2, Hash, ShieldAlert, Crown, Star, Lock, Bot, FileCode2, FolderTree, Folder, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ReportPreviewModal } from '@/components/ReportPreview';
import { SiteCrawlReportData } from '@/components/ReportPreview/generators/siteCrawlHtmlGenerator';
import { HttpStatusChart } from '@/components/SiteCrawl/HttpStatusChart';
import { StrategicErrorBoundary } from '@/components/ExpertAudit/StrategicErrorBoundary';
import { ProAccessGate } from '@/components/ProAccessGate';
import { MaillageIPRCard, computeMaillageFromCrawlPages } from '@/components/ExpertAudit/MaillageIPRCard';
import { FairUseLimitModal } from '@/components/SiteCrawl/FairUseLimitModal';
import { getScoreColor, getScoreBg } from '@/components/SiteCrawl/types';
import { useCrawlEngine } from '@/hooks/useCrawlEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function SiteCrawl() {
  const engine = useCrawlEngine();
  useCanonicalHreflang('/app/site-crawl');

  const {
    user, loading, adminLoading, language, t, isAdmin,
    isUnlimited, isAgencyPro, isAgencyPlus, maxSliderCap,
    credits, creditCost,
    url, setUrl,
    maxPages, setMaxPages,
    isLoading, crawlResult, pages, setPages,
    showTopUp, setShowTopUp,
    progress, phase,
    expandedPage, setExpandedPage,
    sortBy, setSortBy,
    indexFilter, setIndexFilter,
    pastCrawls,
    viewingCrawlId,
    isLoadingPastCrawl,
    crawlBacklinks,
    isScanningBacklinks,
    indexationMap,
    indexedPagesCount,
    sitemapPagesCount,
    totalEstimatedPages,
    isDetectingPages,
    detectionDone,
    preScanDone,
    mappingBlocked,
    discoveredUrls,
    isReportOpen, setIsReportOpen,
    sitemapTree, sitemapPages,
    includeDir, setIncludeDir,
    excludeDir, setExcludeDir,
    includePage, setIncludePage,
    excludePage, setExcludePage,
    showAdvanced, setShowAdvanced,
    maxDepth, setMaxDepth,
    urlFilter, setUrlFilter,
    customSelectors, newSelectorName, setNewSelectorName,
    newSelectorValue, setNewSelectorValue,
    showComparison, setShowComparison,
    compareCrawlA, setCompareCrawlA,
    compareCrawlB, setCompareCrawlB,
    comparisonResult, isComparing,
    subscribeLoading, showUpsell, showLimitModal, setShowLimitModal,
    isButtonShaking, crawlPagesThisMonth, FAIR_USE_LIMIT,
    filteredPages, sortedPages,
    indexedCount, noindexCount,
    issueStats, nearDuplicates, schemaErrorPages, completedCrawls,
    historySectionRef,
    handleDetect, handleSubmit, handleStopCrawl,
    handleSitemapExport, handleCompare,
    handleScanBacklinks, handleSubscribe,
    handleCleanPastCrawls, handleDeleteCrawl,
    viewCrawl, resetViewedCrawl,
    addSelector, removeSelector,
  } = engine;

  // Ready to show slider + launch = either pre-scan (Phase 0) or deep detect (Phase 1) completed
  const readyToLaunch = preScanDone || detectionDone;

  // ── Report data (kept here since it depends on many pieces) ──
  const siteCrawlReportData = useMemo((): SiteCrawlReportData | null => {
    if (!crawlResult) return null;

    const titleMap = new Map<string, string[]>();
    pages.forEach(p => {
      const title = (p.title || '').trim();
      if (!title) return;
      if (!titleMap.has(title)) titleMap.set(title, []);
      titleMap.get(title)!.push(p.url);
    });
    const duplicateTitles = Array.from(titleMap.entries())
      .filter(([, urls]) => urls.length > 1)
      .map(([title, urls]) => ({ title, count: urls.length, urls }))
      .sort((a, b) => b.count - a.count);

    const thinContentPages = pages
      .filter(p => (p.word_count ?? 0) > 0 && (p.word_count ?? 0) < 300 && p.http_status === 200)
      .map(p => ({ url: p.url, path: p.path, word_count: p.word_count ?? 0 }))
      .sort((a, b) => a.word_count - b.word_count);

    const deepPages = pages
      .filter(p => (p as any).crawl_depth != null && (p as any).crawl_depth > 3)
      .map(p => ({ url: p.url, path: p.path, depth: (p as any).crawl_depth as number }))
      .sort((a, b) => b.depth - a.depth);

    const brokenLinksArr: Array<{ source_url: string; broken_url: string; status?: number }> = [];
    pages.forEach(p => {
      const bl = (p as any).broken_links;
      if (Array.isArray(bl)) {
        bl.forEach((link: any) => {
          if (typeof link === 'string') {
            brokenLinksArr.push({ source_url: p.url, broken_url: link });
          } else if (link?.url) {
            brokenLinksArr.push({ source_url: p.url, broken_url: link.url, status: link.status });
          }
        });
      }
    });

    const indexable = pages.filter(p => p.is_indexable !== false && !(p.issues || []).includes('noindex')).length;
    const noindex = pages.length - indexable;

    return {
      domain: crawlResult.domain,
      crawledPages: crawlResult.crawled_pages,
      totalPages: crawlResult.total_pages,
      avgScore: crawlResult.avg_score,
      aiSummary: crawlResult.ai_summary,
      aiRecommendations: crawlResult.ai_recommendations || [],
      issueStats,
      pages: pages.map(p => ({
        url: p.url,
        path: p.path,
        seo_score: p.seo_score,
        http_status: p.http_status,
        title: p.title,
        issues: p.issues || [],
        has_noindex: p.is_indexable === false || (p.issues || []).includes('noindex'),
        word_count: p.word_count,
      })),
      createdAt: crawlResult.created_at,
      duplicateTitles,
      thinContentPages,
      deepPages,
      brokenLinks: brokenLinksArr,
      indexabilityRatio: { indexable, noindex, total: pages.length },
      externalBacklinks: crawlBacklinks.map((bl: any) => ({
        url: bl.url,
        path: bl.path,
        referring_domains: bl.referring_domains || 0,
        backlinks_total: bl.backlinks_total || 0,
        domain_rank_avg: Number(bl.domain_rank_avg) || 0,
        top_anchors: Array.isArray(bl.top_anchors) ? bl.top_anchors : [],
        top_sources: Array.isArray(bl.top_sources) ? bl.top_sources : [],
      })),
    };
  }, [crawlResult, pages, issueStats, crawlBacklinks]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Gate non-connectés : proposer connexion / inscription / abonnement
  if (!user) {
    return (
      <ProAccessGate
        featureName="Crawl Multi-Pages"
        featureDescription="Connectez-vous ou créez un compte pour analyser jusqu'à 5000 pages de votre site."
        returnPath="/app/console"
        returnLabel="Retour Console"
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr</title>
        <meta name="description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/site-crawl" />
        <meta property="og:title" content="Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr" />
        <meta property="og:description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Crawl Multi-Pages SEO — Jusqu'à 5000 pages | Crawlers.fr" />
        <meta name="twitter:description" content="Crawl multi-pages jusqu'à 5000 pages. Analyse récursive sitemap-first. Détection d'erreurs techniques, maillage, indexation. Pro Agency inclus." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <Header />

      <main className="min-h-screen bg-background pt-20 pb-16 relative">

        {/* Pro Agency upsell overlay for non-subscribers */}
        {!isUnlimited && (
          <div className={`fixed inset-x-0 top-16 bottom-0 z-30 flex items-start justify-center pt-8 transition-all duration-700 ease-out ${showUpsell ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
            <div className="relative z-10 w-full max-w-lg mx-4">
              <div className="relative z-20 mb-4">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home'}
                </Link>
              </div>
              <Card className="relative w-full border-2 border-violet-500 ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/5 via-background to-yellow-500/5 shadow-xl shadow-violet-500/10">
              <div className="absolute top-0 left-0">
                <Badge className="rounded-none rounded-br-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-0 px-3 py-1 text-xs font-bold gap-1.5 shadow-lg">
                  <Star className="h-3 w-3 fill-current" />
                  Pro Agency
                </Badge>
              </div>
              <div className="absolute top-0 right-0">
                <Badge className="rounded-none rounded-bl-lg bg-violet-600 text-white border-0 px-3 py-1 text-xs font-bold gap-1.5">
                  <Lock className="h-3 w-3" />
                  Pro
                </Badge>
              </div>
              <CardHeader className="pb-3 pt-10">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-yellow-500/10 border border-violet-500/20">
                    <Crown className="h-5 w-5 text-yellow-500" />
                  </div>
                  <span>{language === 'fr' ? 'Crawl Multi-Pages' : language === 'es' ? 'Crawl Multi-Páginas' : 'Multi-Page Crawl'}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {language === 'fr' 
                    ? 'Analysez jusqu\'à 500 pages de votre site avec un score SEO/200 par page, détection de contenu dupliqué, validation Schema.org et synthèse IA.' 
                    : language === 'es'
                    ? 'Analice hasta 500 páginas de su sitio con puntuación SEO/200 por página, detección de contenido duplicado, validación Schema.org y síntesis IA.'
                    : 'Analyze up to 500 pages with SEO/200 score per page, duplicate content detection, Schema.org validation and AI synthesis.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="grid gap-2">
                  {[
                    language === 'fr' ? 'Audit expert illimité' : language === 'es' ? 'Auditoría experta ilimitada' : 'Unlimited expert audit',
                    language === 'fr' ? 'Code correctif illimité' : language === 'es' ? 'Código correctivo ilimitado' : 'Unlimited corrective code',
                    language === 'fr' ? 'Crawl multi-pages illimité' : language === 'es' ? 'Crawl multi-páginas ilimitado' : 'Unlimited multi-page crawl',
                    language === 'fr' ? 'Marque Blanche (White Label)' : language === 'es' ? 'Marca Blanca (White Label)' : 'White Label branding',
                    language === 'fr' ? 'Assistant IA : Stratège Cocoon' : language === 'es' ? 'Asistente IA: Estratega Cocoon' : 'AI Assistant: Cocoon Strategist',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-card/50 border border-violet-500/10">
                      <div className={`p-1 rounded-md ${i === 0 ? 'bg-violet-500/10' : i === 4 ? 'bg-yellow-500/10' : 'bg-violet-500/10'}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 ${i === 0 ? 'text-violet-500' : i === 4 ? 'text-yellow-500' : 'text-violet-500'}`} />
                      </div>
                      <span className={`text-sm font-medium ${i === 0 ? 'text-foreground' : i === 4 ? 'text-yellow-500' : ''}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline gap-1 justify-center">
                  <span className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                    {language === 'fr' ? '29€' : '€29'}
                  </span>
                  <span className="text-sm text-muted-foreground">/ {language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full gap-2 font-bold bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white shadow-lg shadow-violet-500/25"
                  disabled={subscribeLoading}
                  onClick={handleSubscribe}
                >
                  <Crown className="h-4 w-4 text-yellow-300" />
                  {subscribeLoading
                    ? (language === 'fr' ? 'Redirection…' : language === 'es' ? 'Redirigiendo…' : 'Redirecting…')
                    : (language === 'fr' ? 'S\'abonner' : language === 'es' ? 'Suscribirse' : 'Subscribe')
                  }
                </Button>
              </CardContent>
            </Card>
            </div>
          </div>
        )}

        <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${!isUnlimited ? 'pointer-events-none select-none opacity-40' : ''}`}>
          
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#722F37]/10 text-[#722F37] dark:text-[#c97a82] text-sm font-medium mb-4">
              <Bug className="w-4 h-4" />
              {t.badge}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              {t.h1_1} <span className="text-[#722F37] dark:text-[#c97a82]">{t.h1_2}</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
          </div>

          {/* Crawl Quota Counter */}
          {isUnlimited && crawlPagesThisMonth > 0 && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {language === 'fr' ? 'Pages crawlées ce mois :' : 'Pages crawled this month:'}
                </span>
                <span className={`font-bold text-sm ${crawlPagesThisMonth >= FAIR_USE_LIMIT ? 'text-destructive' : 'text-foreground'}`}>
                  {crawlPagesThisMonth.toLocaleString()} / {FAIR_USE_LIMIT.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Crawl Form */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder={t.placeholder}
                      className="pl-10 caret-primary"
                      disabled={isLoading}
                    />
                  </div>
                  {/* Pre-scan loading indicator (Phase 0 in progress) */}
                  {isDetectingPages && !readyToLaunch && !mappingBlocked && (
                    <Button type="button" disabled className="gap-2 px-6">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.detecting}
                    </Button>
                  )}
                  {/* Launch button (visible once Phase 0 or Phase 1 is done, OR if mapping is blocked) */}
                  {(readyToLaunch || mappingBlocked) && (
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className={`gap-2 rounded-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 shadow-md ${isButtonShaking ? 'animate-shake' : ''}`}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                      {isLoading ? t.crawling : t.launchBtn}
                    </Button>
                  )}
                  {/* Fallback: no URL entered yet */}
                  {!isDetectingPages && !readyToLaunch && !mappingBlocked && (
                    <Button type="button" disabled className="gap-2 px-6">
                      <Search className="h-4 w-4" />
                      {t.launchBtn}
                    </Button>
                  )}
                </div>

                {/* Mapping bloqué par le serveur cible (sitemap 403, robots.txt inaccessible…) */}
                {mappingBlocked && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {language === 'fr'
                        ? 'Pré-mapping bloqué par le serveur cible (sitemap inaccessible). Démarrez l\'analyse — la découverte se fera pendant le crawl.'
                        : language === 'es'
                        ? 'Pre-mapeo bloqueado por el servidor (sitemap inaccesible). Inicie el análisis — el descubrimiento se hará durante el crawl.'
                        : 'Pre-mapping blocked by the target server (sitemap unreachable). Start the analysis — discovery will happen during the crawl.'}
                    </span>
                  </div>
                )}

                {/* Page count info */}
                {(totalEstimatedPages || indexedPagesCount || sitemapPagesCount) && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {sitemapPagesCount != null && (
                      <span className="flex items-center gap-1"><FolderTree className="w-3 h-3" /> Sitemap: {sitemapPagesCount.toLocaleString()}</span>
                    )}
                    {indexedPagesCount != null && (
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Indexed: {indexedPagesCount.toLocaleString()}</span>
                    )}
                    {totalEstimatedPages != null && (
                      <span className="font-medium text-foreground">
                        Total: ~{totalEstimatedPages.toLocaleString()} {t.pages}
                      </span>
                    )}
                    {/* Deep detect button (Phase 1) — optional, appears after Phase 0 */}
                    {readyToLaunch && !detectionDone && !isDetectingPages && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDetect}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto h-6 px-2"
                      >
                        <Search className="w-3 h-3" />
                        {language === 'fr' ? 'Scan approfondi' : language === 'es' ? 'Escaneo profundo' : 'Deep scan'}
                      </Button>
                    )}
                    {isDetectingPages && readyToLaunch && (
                      <span className="flex items-center gap-1 ml-auto text-xs text-violet-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {language === 'fr' ? 'Scan approfondi…' : 'Deep scanning…'}
                      </span>
                    )}
                    {detectionDone && (
                      <span className="flex items-center gap-1 ml-auto text-xs text-emerald-500">
                        <CheckCircle2 className="w-3 h-3" />
                        {language === 'fr' ? 'Scan complet' : 'Full scan done'}
                      </span>
                    )}
                  </div>
                )}

                {/* Slider — visible as soon as Phase 0 (pre-scan) completes */}
                {readyToLaunch && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t.pagesToAnalyze}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{maxPages}</span>
                        {!isUnlimited && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            ({creditCost} <CreditCoin size="sm" />)
                          </span>
                        )}
                        {isUnlimited && <Badge variant="secondary" className="text-[10px]">{t.unlimited}</Badge>}
                      </div>
                    </div>
                    <Slider
                      value={[maxPages]}
                      onValueChange={v => setMaxPages(v[0])}
                      min={5}
                      max={totalEstimatedPages && totalEstimatedPages > 0 ? totalEstimatedPages : maxSliderCap}
                      step={5}
                      disabled={isLoading}
                    />
                    {isLoading && crawlResult && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStopCrawl()}
                          className="gap-1.5"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          {t.stopCrawl}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Directory filters */}
                {readyToLaunch && sitemapTree.length > 0 && (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <Filter className="w-3 h-3" />
                      {language === 'fr' ? 'Filtres de périmètre' : 'Scope filters'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {language === 'fr' ? 'Uniquement les répertoires' : 'Only directories'}
                        </label>
                        <Select value={includeDir} onValueChange={v => { setIncludeDir(v === '__none__' ? '' : v); if (v && v !== '__none__') setExcludeDir(''); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={language === 'fr' ? 'Tous (aucun filtre)' : 'All (no filter)'} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Tous (aucun filtre)' : 'All (no filter)'}</SelectItem>
                            {sitemapTree.map(d => (
                              <SelectItem key={d.path} value={d.path}>
                                <span className="flex items-center gap-1.5"><Folder className="w-3 h-3" /> /{d.label} <span className="text-muted-foreground">({d.count})</span></span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="w-3 h-3 text-red-500" />
                          {language === 'fr' ? 'Sauf les répertoires' : 'Exclude directories'}
                        </label>
                        <Select value={excludeDir} onValueChange={v => { setExcludeDir(v === '__none__' ? '' : v); if (v && v !== '__none__') setIncludeDir(''); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={language === 'fr' ? 'Aucun (aucun filtre)' : 'None (no filter)'} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Aucun (aucun filtre)' : 'None (no filter)'}</SelectItem>
                            {sitemapTree.map(d => (
                              <SelectItem key={d.path} value={d.path}>
                                <span className="flex items-center gap-1.5"><Folder className="w-3 h-3" /> /{d.label} <span className="text-muted-foreground">({d.count})</span></span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {language === 'fr' ? 'Uniquement les pages' : 'Only pages'}
                        </label>
                        <Select value={includePage} onValueChange={v => { setIncludePage(v === '__none__' ? '' : v); if (v && v !== '__none__') setExcludePage(''); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={language === 'fr' ? 'Toutes (aucun filtre)' : 'All (no filter)'} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Toutes (aucun filtre)' : 'All (no filter)'}</SelectItem>
                            {sitemapPages.map(p => (
                              <SelectItem key={p.path} value={p.path}>
                                <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> {p.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="w-3 h-3 text-red-500" />
                          {language === 'fr' ? 'Sauf les pages' : 'Exclude pages'}
                        </label>
                        <Select value={excludePage} onValueChange={v => { setExcludePage(v === '__none__' ? '' : v); if (v && v !== '__none__') setIncludePage(''); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={language === 'fr' ? 'Aucune (aucun filtre)' : 'None (no filter)'} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'fr' ? 'Aucune (aucun filtre)' : 'None (no filter)'}</SelectItem>
                            {sitemapPages.map(p => (
                              <SelectItem key={p.path} value={p.path}>
                                <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> {p.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {(includeDir || excludeDir || includePage || excludePage) && (
                      <div className="flex items-center gap-2 pt-1">
                        <Filter className="w-3 h-3 text-violet-400" />
                        <p className="text-[10px] text-muted-foreground">
                          {includeDir && (language === 'fr' ? `Crawl limité à ${includeDir}/` : `Crawl limited to ${includeDir}/`)}
                          {excludeDir && (language === 'fr' ? `${excludeDir}/ sera ignoré` : `${excludeDir}/ will be excluded`)}
                          {includePage && (language === 'fr' ? `Uniquement les pages contenant "${includePage}"` : `Only pages matching "${includePage}"`)}
                          {excludePage && (language === 'fr' ? `Pages contenant "${excludePage}" exclues` : `Pages matching "${excludePage}" excluded`)}
                        </p>
                        <button type="button" onClick={() => { setIncludeDir(''); setExcludeDir(''); setIncludePage(''); setExcludePage(''); }} className="text-[10px] text-destructive hover:underline ml-auto">
                          {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Options */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start">
                      <Settings2 className="w-4 h-4" />
                      {t.advancedOptions}
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-3 border-t border-border mt-2">
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {t.crawlDepth}: <span className="font-semibold text-foreground">{maxDepth === 0 ? t.depthUnlimited : `${t.depthLevel} ${maxDepth}`}</span>
                      </label>
                      <Slider value={[maxDepth]} onValueChange={v => setMaxDepth(v[0])} min={0} max={10} step={1} disabled={isLoading} />
                      <p className="text-xs text-muted-foreground">0 = {t.depthUnlimited}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        {t.urlFilter}
                      </label>
                      <Input value={urlFilter} onChange={e => setUrlFilter(e.target.value)} placeholder={t.urlFilterPlaceholder} className="font-mono text-sm" disabled={isLoading} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        {t.customSelectors}
                      </label>
                      {customSelectors.map((sel, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                          <span className="font-medium text-foreground">{sel.name}</span>
                          <span className="text-muted-foreground">→</span>
                          <code className="text-violet-400 font-mono flex-1 truncate">{sel.selector}</code>
                          <button type="button" onClick={() => removeSelector(i)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input value={newSelectorName} onChange={e => setNewSelectorName(e.target.value)} placeholder={t.selectorName} className="w-32 text-sm" disabled={isLoading} />
                        <Input value={newSelectorValue} onChange={e => setNewSelectorValue(e.target.value)} placeholder={t.selectorValue} className="flex-1 font-mono text-sm" disabled={isLoading} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSelector())} />
                        <Button type="button" variant="outline" size="sm" onClick={addSelector} disabled={isLoading || !newSelectorName || !newSelectorValue}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </form>

              {isLoading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{phase}</span>
                    <span className="font-mono text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 [&>*]:bg-brand-violet/60" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading past crawl */}
          {crawlResult && isLoadingPastCrawl && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Results */}
          {crawlResult && !isLoadingPastCrawl && (crawlResult.status === 'completed' || viewingCrawlId || (pages.length > 0 && !isLoading)) && (
            <StrategicErrorBoundary onReset={() => { resetViewedCrawl(); }}>
            <div ref={historySectionRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {viewingCrawlId && (
                <div className="flex justify-start">
                  <Button type="button" variant="ghost" size="sm" onClick={resetViewedCrawl} className="gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    {language === 'fr' ? 'Retour aux crawls précédents' : language === 'es' ? 'Volver a los crawls anteriores' : 'Back to previous crawls'}
                  </Button>
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                <Card className="border">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-foreground">{crawlResult.crawled_pages}</div>
                    <div className="text-[10px] text-muted-foreground">{t.pagesAnalyzedLabel}</div>
                  </CardContent>
                </Card>
                <Card className={`border ${getScoreBg(crawlResult.avg_score || 0)}`}>
                  <CardContent className="p-2.5 text-center">
                    <div className={`text-lg font-bold ${getScoreColor(crawlResult.avg_score || 0)}`}>
                      {crawlResult.avg_score}/200
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.avgScore}</div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-foreground">
                      {pages.filter(p => (p.issues || []).length === 0).length}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.perfectPages}</div>
                  </CardContent>
                </Card>
                <Card className="border border-destructive/20 bg-destructive/5">
                  <CardContent className="p-2.5 text-center">
                    <div className="text-lg font-bold text-destructive">
                      {Object.values(issueStats).reduce((s, v) => s + v, 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.totalErrors}</div>
                  </CardContent>
                </Card>
                {(() => {
                  const pagesWithWeight = pages.filter(p => (p as any).html_size_bytes > 0);
                  if (pagesWithWeight.length === 0) return null;
                  const avgWeightKB = Math.round(pagesWithWeight.reduce((s, p) => s + ((p as any).html_size_bytes || 0), 0) / pagesWithWeight.length / 1024);
                  const weightColor = avgWeightKB < 100 ? 'text-emerald-500' : avgWeightKB < 500 ? 'text-amber-500' : 'text-destructive';
                  return (
                    <Card className="border">
                      <CardContent className="p-2.5 text-center">
                        <div className={`text-lg font-bold ${weightColor}`}>{avgWeightKB} Ko</div>
                        <div className="text-[10px] text-muted-foreground">{language === 'fr' ? 'Poids moyen' : language === 'es' ? 'Peso medio' : 'Avg weight'}</div>
                      </CardContent>
                    </Card>
                  );
                })()}
                {indexedPagesCount != null && (
                  <Card className="border">
                    <CardContent className="p-2.5 text-center">
                      <div className="text-lg font-bold text-primary">{indexedPagesCount.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {language === 'fr' ? 'Indexées Google' : language === 'es' ? 'Indexadas Google' : 'Indexed (Google)'}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {crawlResult.tone_consistency_score != null && (
                  <Card className={`border ${crawlResult.tone_consistency_score >= 75 ? 'border-emerald-500/30 bg-emerald-500/5' : crawlResult.tone_consistency_score >= 50 ? 'border-amber-500/30 bg-amber-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <CardContent className="p-2.5 text-center">
                      <div className={`text-lg font-bold ${crawlResult.tone_consistency_score >= 75 ? 'text-emerald-500' : crawlResult.tone_consistency_score >= 50 ? 'text-amber-500' : 'text-destructive'}`}>
                        {crawlResult.tone_consistency_score}/100
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {language === 'fr' ? 'Cohérence tonale' : language === 'es' ? 'Coherencia tonal' : 'Tone Consistency'}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* HTTP Status Chart */}
              {pages.length > 0 && <HttpStatusChart pages={pages} language={language} />}

              {/* Maillage IPR */}
              {pages.length > 0 && (() => {
                const maillageData = computeMaillageFromCrawlPages(pages as any);
                return maillageData ? <MaillageIPRCard data={maillageData} /> : null;
              })()}

              {/* AI Summary */}
              {crawlResult.ai_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                      {t.aiSummary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: crawlResult.ai_summary }} />
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {crawlResult.ai_recommendations?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      {t.priorityRecs}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {crawlResult.ai_recommendations.map((rec: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                          <div className="shrink-0 mt-0.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'}`}>
                              {i + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium">
                              {typeof rec === 'string' ? rec : (rec?.title || rec?.recommendation || rec?.text || `Recommandation ${i + 1}`)}
                            </p>
                            {rec?.pages_affected && (
                              <span className="text-[10px] text-muted-foreground">{rec.pages_affected} {t.pagesAffected}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Errors */}
              {Object.keys(issueStats).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      {t.topErrors}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(issueStats)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 15)
                        .map(([issue, count]) => (
                          <Badge key={issue} variant="outline" className="gap-1.5 text-xs">
                            <span className="font-mono">{count}</span>
                            <span>{issue.replace(/_/g, ' ')}</span>
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Near duplicates & Schema errors */}
              {nearDuplicates.length > 0 && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      {t.duplicateContent} ({nearDuplicates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nearDuplicates.map((p, i) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground truncate">{p.path}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {schemaErrorPages.length > 0 && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      {t.schemaErrors} ({schemaErrorPages.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {schemaErrorPages.map((p, i) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground truncate">{p.path}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Export & Actions bar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleSitemapExport} disabled={pages.length === 0} className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  {t.sitemapExport}
                </Button>
                {siteCrawlReportData && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsReportOpen(true)} className="gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    {t.viewReport}
                  </Button>
                )}
              </div>

              {/* Crawled Pages list */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <CardTitle className="text-lg">{t.crawledPages} ({sortedPages.length})</CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Index filter */}
                      <div className="flex items-center gap-1 text-xs">
                        <button type="button" onClick={() => setIndexFilter('all')} className={`px-2 py-1 rounded ${indexFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                          {language === 'fr' ? 'Toutes' : 'All'} ({pages.length})
                        </button>
                        <button type="button" onClick={() => setIndexFilter('indexed')} className={`px-2 py-1 rounded ${indexFilter === 'indexed' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                          Indexed ({indexedCount})
                        </button>
                        <button type="button" onClick={() => setIndexFilter('noindex')} className={`px-2 py-1 rounded ${indexFilter === 'noindex' ? 'bg-destructive text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                          Noindex ({noindexCount})
                        </button>
                      </div>
                      <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_asc">{t.sortScoreAsc}</SelectItem>
                          <SelectItem value="score_desc">{t.sortScoreDesc}</SelectItem>
                          <SelectItem value="path">{t.sortPath}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {sortedPages.map((page) => (
                      <div key={page.id} className="rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedPage(expandedPage === page.id ? null : page.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className={`text-sm font-bold w-12 text-center ${getScoreColor(page.seo_score || 0)}`}>
                            {page.seo_score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{page.title || t.noTitle}</div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">{page.path}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {page.http_status !== 200 && (
                              <Badge variant="destructive" className="text-[10px]">{page.http_status}</Badge>
                            )}
                            {page.is_indexable === false && (
                              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">noindex</Badge>
                            )}
                            {page.crawl_depth !== undefined && page.crawl_depth! > 0 && (
                              <Badge variant="outline" className="text-[10px] gap-1"><Layers className="w-3 h-3" />{page.crawl_depth}</Badge>
                            )}
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
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">H1:</span>
                                <span className="text-foreground truncate">{page.h1 || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{t.words}</span>
                                <span className="text-foreground">{page.word_count ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Image className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{t.imgsNoAlt}</span>
                                <span className={(page.images_without_alt ?? 0) > 0 ? 'text-destructive' : 'text-emerald-500'}>{page.images_without_alt ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Status:</span>
                                <span className={page.http_status === 200 ? 'text-emerald-500' : 'text-destructive'}>{page.http_status}</span>
                              </div>
                              {(page as any).html_size_bytes > 0 && (() => {
                                const sizeKB = Math.round((page as any).html_size_bytes / 1024);
                                const weightColor = sizeKB < 100 ? 'text-emerald-500' : sizeKB < 500 ? 'text-amber-500' : 'text-destructive';
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">{t.weight}</span>
                                    <span className={weightColor}>{sizeKB} Ko</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {page.has_schema_org && <Badge variant="secondary" className="text-[10px]">Schema.org ✓</Badge>}
                              {page.has_canonical && (() => {
                                const hasCanonicalMismatch = Array.isArray(page.issues) && page.issues.includes('canonical_mismatch');
                                return hasCanonicalMismatch
                                  ? <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Canonical ⚠</Badge>
                                  : <Badge variant="secondary" className="text-[10px]">Canonical ✓</Badge>;
                              })()}
                              {page.has_og && <Badge variant="secondary" className="text-[10px]">OpenGraph ✓</Badge>}
                              {!page.has_schema_org && <Badge variant="destructive" className="text-[10px]">Schema.org ✗</Badge>}
                              {!page.has_canonical && <Badge variant="destructive" className="text-[10px]">Canonical ✗</Badge>}
                              {!page.has_og && <Badge variant="destructive" className="text-[10px]">OG ✗</Badge>}
                            </div>
                            {Array.isArray(page.schema_org_types) && page.schema_org_types.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {page.schema_org_types.map((type, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] text-violet-400 border-violet-400/30">{String(type)}</Badge>
                                ))}
                              </div>
                            )}
                            {Array.isArray(page.schema_org_errors) && page.schema_org_errors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {page.schema_org_errors.map((err, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono">{String(err)}</span>
                                ))}
                              </div>
                            )}
                            {/* Page type classification */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                                {language === 'en' ? 'Page type' : language === 'es' ? 'Tipo de página' : 'Type de page'}
                              </span>
                              <Select
                                value={(page as any).page_type_override || 'auto'}
                                onValueChange={async (val) => {
                                  const override = val === 'auto' ? null : val;
                                  await supabase.from('crawl_pages' as any).update({ page_type_override: override } as any).eq('id', page.id);
                                  setPages(prev => prev.map(p => p.id === page.id ? { ...p, page_type_override: override } as any : p));
                                  toast.success(language === 'en' ? 'Classification updated' : language === 'es' ? 'Clasificación actualizada' : 'Classification mise à jour');
                                }}
                              >
                                <SelectTrigger className="h-6 w-36 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                                  <SelectItem value="homepage" className="text-xs">{language === 'en' ? 'Home' : language === 'es' ? 'Inicio' : 'Accueil'}</SelectItem>
                                  <SelectItem value="blog" className="text-xs">Blog</SelectItem>
                                  <SelectItem value="produit" className="text-xs">{language === 'en' ? 'Product' : language === 'es' ? 'Producto' : 'Produit'}</SelectItem>
                                  <SelectItem value="catégorie" className="text-xs">{language === 'en' ? 'Category' : language === 'es' ? 'Categoría' : 'Catégorie'}</SelectItem>
                                  <SelectItem value="faq" className="text-xs">FAQ</SelectItem>
                                  <SelectItem value="contact" className="text-xs">Contact</SelectItem>
                                  <SelectItem value="tarifs" className="text-xs">{language === 'en' ? 'Pricing' : language === 'es' ? 'Precios' : 'Tarifs'}</SelectItem>
                                  <SelectItem value="guide" className="text-xs">Guide</SelectItem>
                                  <SelectItem value="légal" className="text-xs">{language === 'en' ? 'Legal' : language === 'es' ? 'Legal' : 'Légal'}</SelectItem>
                                  <SelectItem value="à propos" className="text-xs">{language === 'en' ? 'About' : language === 'es' ? 'Acerca de' : 'À propos'}</SelectItem>
                                  <SelectItem value="page" className="text-xs">Page</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {page.custom_extraction && Object.keys(page.custom_extraction).length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Extraction</div>
                                {Object.entries(page.custom_extraction).map(([name, value]) => (
                                  <div key={name} className="flex gap-2 text-xs">
                                    <span className="font-medium text-foreground shrink-0">{name}:</span>
                                    <span className="text-muted-foreground truncate">{typeof value === 'object' ? JSON.stringify(value) : (value || '—')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
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
            </StrategicErrorBoundary>
          )}

          {/* Crawl Comparison */}
          {completedCrawls.length >= 2 && (
            <Card className="mb-6 mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 cursor-pointer" onClick={() => setShowComparison(!showComparison)}>
                  <GitCompare className="w-5 h-5 text-violet-400" />
                  {t.compareCrawls}
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showComparison ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
              {showComparison && (
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">{t.selectCrawlA}</label>
                      <Select value={compareCrawlA} onValueChange={setCompareCrawlA}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {completedCrawls.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.domain} — {new Date(c.created_at).toLocaleDateString()} ({c.avg_score}/200)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">{t.selectCrawlB}</label>
                      <Select value={compareCrawlB} onValueChange={setCompareCrawlB}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {completedCrawls.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.domain} — {new Date(c.created_at).toLocaleDateString()} ({c.avg_score}/200)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCompare}
                      disabled={!compareCrawlA || !compareCrawlB || compareCrawlA === compareCrawlB || isComparing}
                      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white self-end"
                    >
                      {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                      {t.compare}
                    </Button>
                  </div>

                  {comparisonResult && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className={`text-3xl font-bold ${comparisonResult.scoreChange > 0 ? 'text-emerald-500' : comparisonResult.scoreChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {comparisonResult.scoreChange > 0 ? '+' : ''}{comparisonResult.scoreChange} pts
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Score moyen Δ</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                          <div className="text-lg font-bold text-emerald-500">{comparisonResult.newPages.length}</div>
                          <div className="text-xs text-muted-foreground">{t.newPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10 text-center">
                          <div className="text-lg font-bold text-destructive">{comparisonResult.removedPages.length}</div>
                          <div className="text-xs text-muted-foreground">{t.removedPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                          <div className="text-lg font-bold text-emerald-500">{comparisonResult.improved.length}</div>
                          <div className="text-xs text-muted-foreground">{t.improvedPages}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                          <div className="text-lg font-bold text-amber-500">{comparisonResult.degraded.length}</div>
                          <div className="text-xs text-muted-foreground">{t.degradedPages}</div>
                        </div>
                      </div>

                      {comparisonResult.improved.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">↑ {t.improvedPages}</div>
                          {comparisonResult.improved.slice(0, 10).map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                              <span className="text-foreground font-mono truncate flex-1">{p.path}</span>
                              <span className="text-muted-foreground">{p.before}</span>
                              <ArrowRight className="w-3 h-3 mx-1 text-emerald-500" />
                              <span className="text-emerald-500 font-bold">{p.after}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {comparisonResult.degraded.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">↓ {t.degradedPages}</div>
                          {comparisonResult.degraded.slice(0, 10).map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                              <span className="text-foreground font-mono truncate flex-1">{p.path}</span>
                              <span className="text-muted-foreground">{p.before}</span>
                              <ArrowRight className="w-3 h-3 mx-1 text-destructive" />
                              <span className="text-destructive font-bold">{p.after}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Action buttons for past crawl */}
          {viewingCrawlId && crawlResult && (
            <div className="flex items-center justify-center gap-3 pt-4 pb-2">
              {siteCrawlReportData && (
                <Button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="gap-2 px-4 py-2 text-sm font-semibold bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,30%)] text-white border border-[hsl(263,70%,25%)]"
                >
                  <FileText className="h-4 w-4" />
                  {t.viewReport}
                </Button>
              )}
              <Link to={`/app/cocoon?autolaunch=${encodeURIComponent(crawlResult.domain)}`}>
                <Button type="button" variant="outline" className="gap-2 px-4 py-2 text-sm font-semibold border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                  <Sparkles className="h-4 w-4" />
                  Cocoon
                </Button>
              </Link>
              {crawlBacklinks.length === 0 && crawlResult.status === 'completed' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isScanningBacklinks}
                  onClick={handleScanBacklinks}
                  className="gap-2 px-4 py-2 text-sm font-semibold border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                >
                  {isScanningBacklinks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  Scan Backlinks
                </Button>
              )}
              {crawlBacklinks.length > 0 && (
                <span className="text-xs text-amber-500/70 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {crawlBacklinks.length} pages avec backlinks
                </span>
              )}
            </div>
          )}

          {/* Running crawls section */}
          {pastCrawls.filter(c => c.status === 'running' || c.status === 'pending').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t.runningCrawls}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastCrawls.filter(c => c.status === 'running' || c.status === 'pending').map(c => (
                    <div key={c.id} className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 cursor-default">
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.domain}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')} · {c.crawled_pages} {t.pages}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                          onClick={(e) => { e.stopPropagation(); handleStopCrawl(c.id); }}
                          title={t.stopCrawl}
                        >
                          <Square className="w-3 h-3 fill-destructive text-destructive" />
                        </Button>
                        <Badge variant="secondary" className="animate-pulse">{c.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past crawls */}
          {pastCrawls.filter(c => c.status !== 'running' && c.status !== 'pending').length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{t.previousCrawls}</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={handleCleanPastCrawls}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  {language === 'fr' ? 'Nettoyer' : language === 'es' ? 'Limpiar' : 'Clear'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pastCrawls.filter(c => c.status !== 'running' && c.status !== 'pending').map((c, _i, arr) => {
                    const isActive = viewingCrawlId === c.id;
                    const isLatestForDomain = arr.findIndex(x => x.domain === c.domain) === arr.indexOf(c);
                    return (
                      <div key={c.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => viewCrawl(c)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                        >
                          <div>
                            <div className="text-sm font-medium text-foreground">{c.domain}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')} · {c.crawled_pages} {t.pages}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {c.avg_score && (
                              <span className={`text-sm font-bold ${getScoreColor(c.avg_score)}`}>{c.avg_score}/200</span>
                            )}
                            {c.status === 'error' && <Badge variant="destructive">{c.status}</Badge>}
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => { e.stopPropagation(); handleDeleteCrawl(c.id); }}
                          className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive"
                          title={language === 'fr' ? 'Supprimer ce crawl' : 'Delete this crawl'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CTA Cocoon + SEO content */}
          {!isAgencyPro && (
            <>
              <div className="flex justify-center mt-12 mb-8">
                <Link
                  to={`/app/cocoon${crawlResult?.domain ? `?autolaunch=${encodeURIComponent(crawlResult.domain)}` : ''}`}
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-yellow-500 text-yellow-500 font-semibold text-sm tracking-wide uppercase hover:bg-yellow-500/10 transition-colors duration-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Cocoon · Assistant Sémantique
                </Link>
              </div>

              <div className="mt-16 mb-10 max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">{t.whyTitle}</h2>
                  <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{t.whyText}</p>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">{t.scoreTitle}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{t.scoreText}</p>
                </div>
              </div>
            </>
          )}

        </div>
      </main>

      <CreditTopUpModal open={showTopUp} onOpenChange={setShowTopUp} currentBalance={credits} />

      {showLimitModal && (
        <FairUseLimitModal
          language={language}
          crawlPagesThisMonth={crawlPagesThisMonth}
          fairUseLimit={FAIR_USE_LIMIT}
          onClose={() => setShowLimitModal(false)}
        />
      )}

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        type="site_crawl"
        siteCrawlData={siteCrawlReportData}
        currentUrl={siteCrawlReportData?.domain || url}
      />

      {!isAgencyPro && <Footer />}
    </>
  );
}
