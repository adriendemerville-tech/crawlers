import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Loader2, ExternalLink, Search, Globe, Brain, RefreshCw, AlertCircle, ChevronDown, FileJson, Quote, Shield, BookOpen, Layers, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface CompetitorUrl {
  id: string;
  competitor_url: string;
  competitor_domain: string;
  label: string | null;
  crawl_status: string;
  last_crawl_at: string | null;
  seo_score: number | null;
  geo_score: number | null;
  serp_positions: any;
  semantic_relevance: any;
  crawl_data: any;
  audit_data: any;
}

interface ReferenceMetrics {
  seoScore: number | null;
  geoScore: number | null;
  chunkability: number | null;
  structure: number | null;
  quotability: number | null;
  eeat: number | null;
  semanticRichness: number | null;
  schemaCount: number | null;
  hasJsonLd: boolean;
  metaDescPresent: boolean;
  metaDescLength: number | null;
  serpTop10: number | null;
  relevance: number | null;
}

interface Props {
  trackedSiteId: string;
  domain: string;
  userId: string;
  language: string;
}

const t3 = (lang: string, fr: string, en: string) => lang === 'fr' ? fr : en;

function DeltaBadge({ refVal, compVal }: { refVal: number | null | undefined; compVal: number | null | undefined }) {
  if (refVal == null || compVal == null) return null;
  const delta = Math.round(compVal - refVal);
  if (delta === 0) return <span className="text-[9px] text-muted-foreground">=</span>;
  const isWorse = delta > 0; // competitor higher = worse for user
  return (
    <span className={cn("text-[9px] font-medium", isWorse ? "text-red-500" : "text-green-500")}>
      {isWorse ? `+${delta}` : delta}
    </span>
  );
}

function MiniScoreWithRef({ label, score, refScore, icon: Icon, lang }: {
  label: string; score: number | null | undefined; refScore: number | null | undefined; icon: any; lang: string;
}) {
  const color = score == null ? 'text-muted-foreground' :
    score >= 70 ? 'text-green-600 dark:text-green-400' :
    score >= 40 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  const card = (
    <div className="rounded-lg border bg-muted/30 p-2.5 cursor-default">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <p className={cn("text-sm font-semibold", color)}>
          {score != null ? `${Math.round(score)}%` : '—'}
        </p>
        <DeltaBadge refVal={refScore} compVal={score} />
      </div>
    </div>
  );

  if (refScore == null) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs space-y-0.5">
        <p className="font-medium">{t3(lang, 'Votre site', 'Your site')}: <span className="text-primary">{Math.round(refScore)}%</span></p>
        <p className="text-muted-foreground">{t3(lang, 'Concurrent', 'Competitor')}: {score != null ? `${Math.round(score)}%` : '—'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function CompetitorTrackingTab({ trackedSiteId, domain, userId, language }: Props) {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<CompetitorUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [expandedGeo, setExpandedGeo] = useState<Record<string, boolean>>({});
  const [refMetrics, setRefMetrics] = useState<ReferenceMetrics | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);

  const fetchCompetitors = useCallback(async () => {
    const { data } = await supabase
      .from('competitor_tracked_urls')
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setCompetitors((data as any[]) || []);
    setLoading(false);
  }, [trackedSiteId, userId]);

  // Fetch reference site metrics from latest audit_raw_data
  const fetchRefMetrics = useCallback(async () => {
    if (refMetrics || loadingRef) return;
    setLoadingRef(true);
    try {
      // Try to get from latest competitor record for this site (self-audit stored in audit_data)
      // Or from audit_raw_data
      const { data: rawGeo } = await supabase
        .from('audit_raw_data')
        .select('raw_payload')
        .eq('domain', domain.replace(/^www\./, ''))
        .eq('audit_type', 'lead_magnet_geo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: rawSeo } = await supabase
        .from('audit_raw_data')
        .select('raw_payload')
        .eq('domain', domain.replace(/^www\./, ''))
        .in('audit_type', ['lead_magnet_seo', 'lead_magnet_expert'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Also try to get self-audit from competitor_tracked_urls where competitor = self
      // But better: fetch from tracked_sites or latest audit data
      const geoPayload = rawGeo?.raw_payload as any;
      const seoPayload = rawSeo?.raw_payload as any;

      setRefMetrics({
        seoScore: seoPayload?.totalScore ?? seoPayload?.score ?? null,
        geoScore: geoPayload?.totalScore ?? null,
        chunkability: null, // These need HTML analysis which we don't store for ref
        structure: null,
        quotability: null,
        eeat: null,
        semanticRichness: null,
        schemaCount: null,
        hasJsonLd: false,
        metaDescPresent: false,
        metaDescLength: null,
        serpTop10: null,
        relevance: null,
      });
    } catch (e) {
      console.warn('Failed to fetch ref metrics:', e);
    } finally {
      setLoadingRef(false);
    }
  }, [domain, refMetrics, loadingRef]);

  useEffect(() => { fetchCompetitors(); }, [fetchCompetitors]);
  useEffect(() => { if (competitors.length > 0 && !refMetrics) fetchRefMetrics(); }, [competitors.length, refMetrics, fetchRefMetrics]);

  const normalizeUrl = (url: string): string => {
    let u = url.trim();
    if (!u.startsWith('http')) u = 'https://' + u;
    try { return new URL(u).href; } catch { return ''; }
  };

  const extractDomain = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  };

  const handleAdd = async () => {
    const normalized = normalizeUrl(newUrl);
    if (!normalized) { toast.error(t3(language, 'URL invalide', 'Invalid URL')); return; }
    const compDomain = extractDomain(normalized);
    if (compDomain === domain.replace(/^www\./, '')) {
      toast.error(t3(language, 'Vous ne pouvez pas tracker votre propre domaine', 'You cannot track your own domain'));
      return;
    }
    if (competitors.length >= 3) {
      toast.error(t3(language, 'Maximum 3 concurrents par site', 'Maximum 3 competitors per site'));
      return;
    }
    if (competitors.some(c => c.competitor_url === normalized || c.competitor_domain === compDomain)) {
      toast.error(t3(language, 'Ce concurrent est déjà suivi', 'This competitor is already tracked'));
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('competitor_tracked_urls').insert({
        user_id: userId,
        tracked_site_id: trackedSiteId,
        competitor_url: normalized,
        competitor_domain: compDomain,
        crawl_status: 'pending',
      } as any);
      if (error) throw error;

      toast.success(t3(language, 'Concurrent ajouté — crawl en cours…', 'Competitor added — crawling…'));
      setNewUrl('');
      setShowAddModal(false);
      await fetchCompetitors();

      supabase.functions.invoke('audit-competitor-url', {
        body: { competitorUrl: normalized, competitorDomain: compDomain, trackedSiteId, referenceDomain: domain },
      }).catch(e => console.warn('Competitor audit trigger failed:', e));

    } catch (e: any) {
      toast.error(e.message || 'Error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('competitor_tracked_urls').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t3(language, 'Concurrent retiré', 'Competitor removed'));
    setCompetitors(prev => prev.filter(c => c.id !== id));
  };

  const handleRefresh = async (comp: CompetitorUrl) => {
    setRefreshingId(comp.id);
    try {
      await supabase.from('competitor_tracked_urls').update({ crawl_status: 'pending' } as any).eq('id', comp.id);
      await supabase.functions.invoke('audit-competitor-url', {
        body: { competitorUrl: comp.competitor_url, competitorDomain: comp.competitor_domain, trackedSiteId, referenceDomain: domain },
      });
      toast.success(t3(language, 'Mise à jour lancée', 'Refresh started'));
      await fetchCompetitors();
    } catch {
      toast.error(t3(language, 'Erreur lors de la mise à jour', 'Refresh error'));
    } finally {
      setRefreshingId(null);
    }
  };

  // CSV Export
  const handleExportCsv = useCallback(() => {
    const doneComps = competitors.filter(c => c.crawl_status === 'done');
    if (doneComps.length === 0) {
      toast.error(t3(language, 'Aucun concurrent analysé à exporter', 'No analyzed competitors to export'));
      return;
    }

    const kpiLabels = [
      'Score SEO (%)', 'Score GEO (%)', 'Pertinence sémantique (%)', 'Positions Top 10',
      'Chunkabilité (%)', 'Structure (%)', 'Quotabilité (%)', 'E-E-A-T (%)',
      'Richesse sémantique (%)', 'Schema.org (blocs)', 'Meta description (car.)',
    ];

    const getKpiValues = (comp: CompetitorUrl) => {
      const gm = comp.audit_data?.geoMetrics;
      const serpArr = Array.isArray(comp.serp_positions) ? comp.serp_positions : [];
      return [
        comp.seo_score ?? '',
        comp.geo_score ?? '',
        comp.semantic_relevance?.score ?? '',
        serpArr.filter((p: any) => p.position <= 10).length,
        gm?.chunkability?.score ?? '',
        gm?.structure?.score ?? '',
        gm?.quotability?.score ?? '',
        gm?.eeat?.score ?? '',
        gm?.semanticRichness?.score ?? '',
        gm?.schema?.schemaCount ?? '',
        gm?.metaDescription?.length ?? '',
      ];
    };

    const refValues = [
      refMetrics?.seoScore ?? '',
      refMetrics?.geoScore ?? '',
      refMetrics?.relevance ?? '100',
      refMetrics?.serpTop10 ?? '',
      refMetrics?.chunkability ?? '',
      refMetrics?.structure ?? '',
      refMetrics?.quotability ?? '',
      refMetrics?.eeat ?? '',
      refMetrics?.semanticRichness ?? '',
      refMetrics?.schemaCount ?? '',
      refMetrics?.metaDescLength ?? '',
    ];

    // Build CSV
    const headers = ['KPI', `${domain} (cible)`, ...doneComps.map(c => c.competitor_domain)];
    const rows = kpiLabels.map((label, i) => {
      return [label, refValues[i], ...doneComps.map(c => getKpiValues(c)[i])];
    });

    const csvContent = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparatif-concurrence-${domain}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t3(language, 'Rapport CSV exporté', 'CSV report exported'));
  }, [competitors, domain, refMetrics, language]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: t3(language, 'En attente', 'Pending'), variant: 'outline' },
      crawling: { label: t3(language, 'Crawl…', 'Crawling…'), variant: 'secondary' },
      done: { label: t3(language, 'Terminé', 'Done'), variant: 'default' },
      error: { label: t3(language, 'Erreur', 'Error'), variant: 'destructive' },
    };
    const s = map[status] || map.pending;
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t3(language,
              `Suivez jusqu'à 3 URLs concurrentes. Survolez un score pour comparer avec votre site.`,
              `Track up to 3 competitor URLs. Hover a score to compare with your site.`
            )}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {competitors.some(c => c.crawl_status === 'done') && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
            {competitors.length < 3 && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddModal(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t3(language, 'Ajouter', 'Add')}
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {competitors.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t3(language, 'Aucun concurrent suivi', 'No competitors tracked')}</p>
            <Button variant="outline" className="mt-3 gap-2" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              {t3(language, 'Ajouter un concurrent', 'Add a competitor')}
            </Button>
          </div>
        )}

        {/* Competitor cards */}
        {competitors.map(comp => {
          const serpPositions = Array.isArray(comp.serp_positions) ? comp.serp_positions : [];
          const semRelevance = comp.semantic_relevance || {};
          const isRefreshing = refreshingId === comp.id || comp.crawl_status === 'crawling';
          const gm = comp.audit_data?.geoMetrics;
          const isGeoExpanded = expandedGeo[comp.id] || false;

          return (
            <Card key={comp.id} className="border">
              <CardContent className="p-4 space-y-3">
                {/* Row 1: URL + actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <a href={comp.competitor_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline truncate">
                      {comp.competitor_domain}
                    </a>
                    <a href={comp.competitor_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {statusBadge(comp.crawl_status)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                      onClick={() => navigate(`/audit-expert?url=${encodeURIComponent(comp.competitor_url)}`)}>
                      {t3(language, 'Auditer', 'Audit')}
                    </Button>
                    {comp.crawl_status === 'done' && (
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                        onClick={() => navigate(`/app/conversion-optimizer?url=${encodeURIComponent(comp.competitor_url)}`)}>
                        UX
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isRefreshing}
                      onClick={() => handleRefresh(comp)}>
                      <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(comp.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Primary scores with ref comparison */}
                {comp.crawl_status === 'done' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniScoreWithRef label="Score SEO" score={comp.seo_score} refScore={refMetrics?.seoScore} icon={Search} lang={language} />
                    <MiniScoreWithRef label="Score GEO" score={comp.geo_score} refScore={refMetrics?.geoScore} icon={Globe} lang={language} />
                    <MiniScoreWithRef label={t3(language, 'Pertinence', 'Relevance')} score={semRelevance?.score} refScore={100} icon={Brain} lang={language} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-lg border bg-muted/30 p-2.5 cursor-default">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                            <Search className="h-3 w-3" />
                            <span>{t3(language, 'Positions SERP', 'SERP Positions')}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {serpPositions.length > 0
                              ? `${serpPositions.filter((p: any) => p.position <= 10).length} top 10`
                              : '—'}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>{t3(language, 'Mots-clés partagés dans le top 30', 'Shared keywords in top 30')}: {serpPositions.length}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Row 3: GEO Metrics (collapsible) */}
                {comp.crawl_status === 'done' && gm && (
                  <Collapsible open={isGeoExpanded} onOpenChange={v => setExpandedGeo(prev => ({ ...prev, [comp.id]: v }))}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs text-muted-foreground hover:text-foreground px-1">
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3" />
                          {t3(language, 'Métriques GEO détaillées', 'Detailed GEO metrics')}
                        </span>
                        <ChevronDown className={cn("h-3 w-3 transition-transform", isGeoExpanded && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <MiniScoreWithRef label={t3(language, 'Chunkabilité', 'Chunkability')} score={gm.chunkability?.score} refScore={refMetrics?.chunkability} icon={Layers} lang={language} />
                        <MiniScoreWithRef label={t3(language, 'Structure', 'Structure')} score={gm.structure?.score} refScore={refMetrics?.structure} icon={BookOpen} lang={language} />
                        <MiniScoreWithRef label={t3(language, 'Quotabilité', 'Quotability')} score={gm.quotability?.score} refScore={refMetrics?.quotability} icon={Quote} lang={language} />
                        <MiniScoreWithRef label="E-E-A-T" score={gm.eeat?.score} refScore={refMetrics?.eeat} icon={Shield} lang={language} />
                        <MiniScoreWithRef label={t3(language, 'Richesse sém.', 'Semantic Rich.')} score={gm.semanticRichness?.score} refScore={refMetrics?.semanticRichness} icon={Brain} lang={language} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="rounded-lg border bg-muted/30 p-2.5 cursor-default">
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                <FileJson className="h-3 w-3" />
                                <span>Schema.org</span>
                              </div>
                              <p className={cn("text-sm font-semibold", gm.schema?.hasJsonLd ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                                {gm.schema?.hasJsonLd ? `${gm.schema.schemaCount} bloc${gm.schema.schemaCount > 1 ? 's' : ''}` : t3(language, 'Absent', 'Missing')}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {gm.schema?.schemaTypes?.length > 0 && <p>Types: {gm.schema.schemaTypes.join(', ')}</p>}
                            {refMetrics?.schemaCount != null && <p>{t3(language, 'Votre site', 'Your site')}: {refMetrics.schemaCount} blocs</p>}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Detail chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {gm.metaDescription?.present ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                            Meta desc: {gm.metaDescription.length} car.
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-red-500/10 text-red-700 dark:text-red-400">
                            {t3(language, 'Meta desc manquante', 'Missing meta desc')}
                          </Badge>
                        )}
                        {gm.structure?.details && (
                          <>
                            {gm.structure.details.faq && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">FAQ ✓</Badge>}
                            {gm.structure.details.tables && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">{t3(language, 'Tableaux', 'Tables')} ✓</Badge>}
                            {gm.structure.details.lists && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">{t3(language, 'Listes', 'Lists')} ✓</Badge>}
                            <Badge variant="outline" className="text-[10px]">H2: {gm.structure.details.h2Count} | H3: {gm.structure.details.h3Count}</Badge>
                          </>
                        )}
                        {gm.chunkability?.hasToc && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">{t3(language, 'Sommaire', 'TOC')} ✓</Badge>}
                        {gm.faqWithSchema && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">FAQ Schema ✓</Badge>}
                        <Badge variant="outline" className="text-[10px]">{gm.wordCount || 0} {t3(language, 'mots', 'words')}</Badge>
                      </div>

                      {/* Quotability samples */}
                      {gm.quotability?.samples?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {t3(language, 'Phrases quotables', 'Quotable sentences')}
                          </p>
                          {gm.quotability.samples.map((s: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 line-clamp-2">"{s}"</p>
                          ))}
                        </div>
                      )}

                      {/* EEAT signals */}
                      {gm.eeat?.signals && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(gm.eeat.signals as Record<string, boolean>).map(([key, val]) => (
                            <Badge key={key} variant="outline" className={cn("text-[10px]",
                              val ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'
                            )}>
                              {key.replace(/([A-Z])/g, ' $1').trim()} {val ? '✓' : '✗'}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Row 4: SERP details */}
                {comp.crawl_status === 'done' && serpPositions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {t3(language, 'Mots-clés surveillés', 'Tracked keywords')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {serpPositions.slice(0, 10).map((kw: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1">
                          <span className="truncate max-w-[120px]">{kw.keyword}</span>
                          <span className={cn("font-bold",
                            kw.position <= 3 ? 'text-green-600' : kw.position <= 10 ? 'text-amber-600' : 'text-red-500'
                          )}>
                            #{kw.position}
                          </span>
                        </Badge>
                      ))}
                      {serpPositions.length > 10 && (
                        <Badge variant="outline" className="text-[10px]">+{serpPositions.length - 10}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {(comp.crawl_status === 'pending' || comp.crawl_status === 'crawling') && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t3(language, 'Analyse en cours — les résultats apparaîtront ici automatiquement.', 'Analysis in progress — results will appear here automatically.')}
                  </div>
                )}

                {comp.crawl_status === 'error' && (
                  <div className="flex items-center gap-2 text-xs text-destructive py-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {t3(language, 'Erreur lors de l\'analyse. Relancez avec le bouton de rafraîchissement.', 'Analysis error. Retry with the refresh button.')}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Add modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t3(language, 'Ajouter un concurrent', 'Add a competitor')}</DialogTitle>
              <DialogDescription>
                {t3(language,
                  'Entrez l\'URL d\'un concurrent. Un crawl et un audit SEO/GEO seront lancés automatiquement.',
                  'Enter a competitor URL. A crawl and SEO/GEO audit will start automatically.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://concurrent.com"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={adding || !newUrl.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : t3(language, 'Ajouter', 'Add')}
              </Button>
            </div>
            <DialogClose />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
