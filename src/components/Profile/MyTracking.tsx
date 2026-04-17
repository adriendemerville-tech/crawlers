import { useState, useCallback, useEffect, ElementType } from 'react';
import { ActiveCrawlBanner } from '@/components/Profile/ActiveCrawlBanner';
import { AnomalyAlertsBanner } from '@/components/Console/AnomalyAlertsBanner';

import { useIsMobile } from '@/hooks/use-mobile';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Radar, Trash2, TrendingUp, Globe, Brain, BarChart3, Loader2, ExternalLink, Gauge, Wrench, Plug, Unplug, Download, Link2, MoreVertical, AlertCircle, Search, CheckCircle2, MousePointerClick, Eye, Undo2, RefreshCw, Info, Cable, IdCard, Bot, Activity, Lock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { isSiteSynced } from '@/utils/wpIntegration';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Bar, BarChart, ComposedChart } from 'recharts';
import { SmartConfigurator } from '@/components/ExpertAudit/CorrectiveCodeEditor/SmartConfigurator';
import { SerpKpiBanner } from '@/components/Profile/SerpKpiBanner';
import { KeywordCloud } from '@/components/Profile/KeywordCloud';
import { TopKeywordsList } from '@/components/Profile/TopKeywordsList';
import { QuickWinsCard } from '@/components/Profile/QuickWinsCard';
import { LLMVisibilityDashboard } from '@/components/Profile/LLMVisibilityDashboard';
import { SmartRecommendationsPanel } from '@/components/Profile/SmartRecommendationsPanel';
import { LLMDepthCard } from '@/components/Profile/LLMDepthCard';
import { FanOutRadarWidget } from '@/components/Profile/FanOutRadarWidget';
import { WordPressConfigCard } from '@/components/Profile/WordPressConfigCard';
import { IASCard } from '@/components/Profile/IASCard';
import { ExternalApisTab } from '@/components/Profile/ExternalApisTab';
import { SiteIdentityModal } from '@/components/Profile/SiteIdentityModal';
import { BotLogAnalysisCard } from '@/components/Profile/BotLogAnalysisCard';
import { CompetitorTrackingTab } from '@/components/Profile/CompetitorTrackingTab';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMyTracking, type TrackedSite, type StatsEntry } from '@/hooks/useMyTracking';

// ─── Translations ───
const translations = {
  fr: {
    title: 'Mes sites',
    description: 'Suivez l\'évolution SEO & IA de vos sites au fil du temps.',
    noSites: 'Aucun site suivi pour le moment.',
    addSite: 'Ajouter une URL',
    addSiteDesc: 'Entrez l\'URL du site à suivre. Un audit de référence sera lancé automatiquement.',
    urlPlaceholder: 'https://exemple.com',
    add: 'Ajouter',
    adding: 'Ajout...',
    remove: 'Retirer',
    removeConfirm: 'Site retiré du suivi',
    lastAudit: 'Dernier audit complet',
    never: 'Jamais',
    aiVisibility: 'Visibilité IA',
    seoScore: 'Score SEO',
    geoScore: 'Score GEO',
    citationRate: 'Taux de citation LLM',
    sentiment: 'Sentiment IA',
    performance: 'Performance',
    performanceMobile: 'Perf. Mobile',
    performanceDesktop: 'Perf. Desktop',
    semanticAuth: 'Autorité sémantique',
    voiceShare: 'Part de voix',
    evolution: 'Évolution',
    kpis: 'KPIs',
    refreshing: 'Mise à jour...',
    autoRefresh: 'Mis à jour automatiquement',
    invalidUrl: 'URL invalide',
    alreadyTracked: 'Ce site est déjà suivi',
  },
  en: {
    title: 'My Sites',
    description: 'Track the SEO & AI evolution of your sites over time.',
    noSites: 'No tracked sites yet.',
    addSite: 'Add a site',
    addSiteDesc: 'Enter the site URL to track. A baseline audit will run automatically.',
    urlPlaceholder: 'https://example.com',
    add: 'Add',
    adding: 'Adding...',
    remove: 'Remove',
    removeConfirm: 'Site removed from tracking',
    lastAudit: 'Last full audit',
    never: 'Never',
    aiVisibility: 'AI Visibility',
    seoScore: 'SEO Score',
    geoScore: 'GEO Score',
    citationRate: 'LLM Citation Rate',
    sentiment: 'AI Sentiment',
    performance: 'Performance',
    performanceMobile: 'Perf. Mobile',
    performanceDesktop: 'Perf. Desktop',
    semanticAuth: 'Semantic Authority',
    voiceShare: 'Voice Share',
    evolution: 'Evolution',
    kpis: 'KPIs',
    refreshing: 'Updating...',
    autoRefresh: 'Auto-updated',
    invalidUrl: 'Invalid URL',
    alreadyTracked: 'This site is already tracked',
  },
  es: {
    title: 'Mis sitios',
    description: 'Siga la evolución SEO e IA de sus sitios a lo largo del tiempo.',
    noSites: 'Ningún sitio rastreado por el momento.',
    addSite: 'Añadir un sitio',
    addSiteDesc: 'Introduzca la URL del sitio a seguir. Una auditoría de referencia se lanzará automáticamente.',
    urlPlaceholder: 'https://ejemplo.com',
    add: 'Añadir',
    adding: 'Añadiendo...',
    remove: 'Eliminar',
    removeConfirm: 'Sitio eliminado del seguimiento',
    lastAudit: 'Última auditoría completa',
    never: 'Nunca',
    aiVisibility: 'Visibilidad IA',
    seoScore: 'Score SEO',
    geoScore: 'Score GEO',
    citationRate: 'Tasa de citación LLM',
    sentiment: 'Sentimiento IA',
    performance: 'Rendimiento',
    performanceMobile: 'Rend. Móvil',
    performanceDesktop: 'Rend. Escritorio',
    semanticAuth: 'Autoridad semántica',
    voiceShare: 'Cuota de voz',
    evolution: 'Evolución',
    kpis: 'KPIs',
    refreshing: 'Actualizando...',
    autoRefresh: 'Actualizado automáticamente',
    invalidUrl: 'URL inválida',
    alreadyTracked: 'Este sitio ya está siendo seguido',
  },
};

// ─── Sortable sidebar button ───
function SortableSiteButton({ id, label, isActive, isRefreshing, onClick }: {
  id: string; label: string; isActive: boolean; isRefreshing: boolean; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors truncate whitespace-nowrap shrink-0 ${
        isActive
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
      }`}
    >
      <span className="truncate">{label}</span>
      {isRefreshing && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
    </button>
  );
}

// ─── KPI Card ───
function KPICard({ label, value, icon: Icon, valueClassName, onRefresh, tooltip }: { label: string; value: string; icon: ElementType; valueClassName?: string; onRefresh?: () => Promise<void>; tooltip?: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  return (
    <div className="relative group rounded-lg border bg-card p-3 flex flex-col justify-between min-h-[68px]">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="leading-tight">{label}</span>
        {tooltip && (
          <Popover open={showTooltip} onOpenChange={setShowTooltip}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
                className="ml-auto shrink-0 p-0.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Info"
              >
                <Info className="h-3 w-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-52 p-2.5">
              {tooltip.split('\n').map((line, i) => (
                <p key={i} className={i === 0 ? 'text-[11px] font-semibold text-foreground' : 'text-[11px] text-muted-foreground mt-1 leading-snug'}>{line}</p>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p className={`text-base font-semibold mt-1 ${valueClassName || ''}`}>{value}</p>
      {onRefresh && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted disabled:opacity-50"
          aria-label="Actualiser"
        >
          <RefreshCw className={cn("h-3 w-3 text-muted-foreground", refreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}

// ─── Sortable KPI Grid ───
function SortableKPIGrid({ kpiDefinitions, defaultOrder, disabled, onRefresh }: {
  kpiDefinitions: Record<string, { label: string; value: string; icon: ElementType; valueClassName?: string; tooltip?: string }>;
  defaultOrder: string[];
  disabled: boolean;
  onRefresh?: Record<string, () => Promise<void>>;
}) {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {defaultOrder.map(id => {
            const def = kpiDefinitions[id];
            if (!def) return null;
            return (
              <KPICard
                key={id}
                label={def.label}
                value={def.value}
                icon={def.icon}
                valueClassName={def.valueClassName}
                onRefresh={onRefresh?.[id]}
                tooltip={def.tooltip}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sentiment helpers ───
const sentimentLabel = (s: string | null) => {
  if (!s) return '—';
  const map: Record<string, string> = {
    positive: 'Très positif', mostly_positive: 'Plutôt positif',
    neutral: 'Neutre', mixed: 'Mitigé', negative: 'Négatif'
  };
  return map[s] || s;
};

const sentimentColor = (s: string | null) => {
  if (!s) return '';
  const map: Record<string, string> = {
    positive: 'text-green-700 dark:text-green-300',
    mostly_positive: 'text-teal-700 dark:text-teal-300',
    neutral: 'text-gray-600 dark:text-gray-400',
    mixed: 'text-orange-700 dark:text-orange-400',
    negative: 'text-red-700 dark:text-red-400',
  };
  return map[s] || '';
};

// ─── Main Component ───
export function MyTracking({ externalSiteId, forceApiPanel, onApiPanelOpened }: { externalSiteId?: string | null; forceApiPanel?: boolean; onApiPanelOpened?: () => void }) {
  const h = useMyTracking();
  const t = translations[h.language] || translations.fr;
  const navigate = useNavigate();
  const [hasAnyApiConnected, setHasAnyApiConnected] = useState(false);
  const isMobile = useIsMobile();

  // Open API panel when triggered from sidebar
  useEffect(() => {
    if (forceApiPanel && !h.showApiPanel) {
      h.setShowApiPanel(true);
      h.setSelectedSite(null);
      onApiPanelOpened?.();
    }
  }, [forceApiPanel]);

  // Sync with sidebar domain selector
  useEffect(() => {
    if (externalSiteId && externalSiteId !== h.selectedSite && h.sites.some(s => s.id === externalSiteId)) {
      h.setSelectedSite(externalSiteId);
    }
  }, [externalSiteId, h.sites]);


  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleSiteDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    h.setSites(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id);
      const newIdx = prev.findIndex(s => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  if (h.loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AnomalyAlertsBanner trackedSiteId={h.selectedSite} domain={h.currentSite?.domain || ''} simulatedDataEnabled={h.simulatedDataEnabled} />
      <ActiveCrawlBanner />
      
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {h.sites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t.noSites}</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => h.setShowAddModal(true)}>
                <Plus className="h-4 w-4" />
                {t.addSite}
              </Button>
            </div>
          ) : (
            <div>
              {/* Add site + API buttons */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => h.setShowAddModal(true)}
                  aria-label={t.addSite}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-dashed border-border/50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.addSite}</span>
                </button>
                <button
                  onClick={() => { h.setShowApiPanel(!h.showApiPanel); if (!h.showApiPanel) h.setSelectedSite(null); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                    h.showApiPanel
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Cable className="h-3.5 w-3.5" />
                  <span>API</span>
                  {hasAnyApiConnected && (
                    <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-500" />
                  )}
                </button>
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {h.showApiPanel && <ExternalApisTab onConnectionChange={setHasAnyApiConnected} />}

                {h.currentSite && !h.showApiPanel && (
                  <div className="space-y-6">
                    {/* Site header */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => h.setShowIdentityModal(true)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-muted-foreground/25 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors bg-transparent"
                          title="Carte d'identité"
                        >
                          <IdCard className="h-4 w-4" />
                        </button>
                        <a
                          href={`https://${h.currentSite.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                          title={h.currentSite.domain}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <p className="text-xs text-muted-foreground/70">
                          {t.lastAudit} : {h.currentSite.last_audit_at
                            ? new Date(h.currentSite.last_audit_at).toLocaleDateString(h.language === 'fr' ? 'fr-FR' : h.language === 'es' ? 'es-ES' : 'en-US')
                            : t.never}
                          {h.refreshingSites.has(h.currentSite.id) && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              {t.refreshing}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">

                        {/* Connect/Disconnect site button */}
                        {(() => {
                          const siteIsIkTracker = h.isIkTrackerSite(h.currentSite.domain);
                          if (siteIsIkTracker) {
                            const isOn = h.ikTrackerConnected === true;
                            const tooltipText = isOn
                              ? (h.language === 'fr' ? 'API IKTracker branchée' : h.language === 'es' ? 'API IKTracker conectada' : 'IKTracker API connected')
                              : (h.language === 'fr' ? 'API IKTracker débranchée' : h.language === 'es' ? 'API IKTracker desconectada' : 'IKTracker API disconnected');
                            return (
                              <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                  "h-8 w-8 relative group",
                                  isOn && "border-emerald-500/50 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10",
                                  !isOn && ""
                                )}
                                onClick={h.handleToggleIkTracker}
                                disabled={h.ikTrackerToggling || h.ikTrackerConnected === null}
                              >
                                {h.ikTrackerToggling ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : isOn ? (
                                  <Unplug className="h-3.5 w-3.5" />
                                ) : (
                                  <>
                                    <Plug className="h-3.5 w-3.5" />
                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-orange-500" />
                                  </>
                                )}
                                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded bg-popover border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                  {tooltipText}
                                </span>
                              </Button>
                            );
                          }

                          const synced = isSiteSynced(h.currentSite.current_config as Record<string, unknown>);
                          const pingDate = h.currentSite.last_widget_ping ? new Date(h.currentSite.last_widget_ping as string) : null;
                          const isWidgetAlive = pingDate && (Date.now() - pingDate.getTime()) < 24 * 60 * 60 * 1000;
                          const isConnected = synced || isWidgetAlive;
                          const isStale = synced && !isWidgetAlive;
                          const tooltipText = isConnected && !isStale
                            ? (h.language === 'fr' ? 'Votre site est branché' : h.language === 'es' ? 'Su sitio está conectado' : 'Your site is connected')
                            : (h.language === 'fr' ? 'Votre site est débranché' : h.language === 'es' ? 'Su sitio está desconectado' : 'Your site is disconnected');
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={cn(
                                    "h-8 w-8 relative group",
                                    isConnected && !isStale && "border-emerald-500/50 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10",
                                    isStale && "border-amber-500/50 text-amber-600 hover:text-amber-500 hover:bg-amber-500/10",
                                    !isConnected && !isStale && ""
                                  )}
                                  onClick={() => {
                                    h.setWpConnectSiteId(h.currentSite!.id);
                                    h.setShowWpModal(true);
                                    h.setWpApiKeyVisible(false);
                                    h.setWpApiKeyCopied(false);
                                  }}
                                >
                                  {isConnected && !isStale ? (
                                    <Unplug className="h-3.5 w-3.5" />
                                  ) : (
                                    <>
                                      <Plug className="h-3.5 w-3.5" />
                                      <span className={cn(
                                        "absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background",
                                        isStale ? "bg-amber-500 animate-pulse" : "bg-orange-500"
                                      )} />
                                    </>
                                  )}
                                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded bg-popover border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    {tooltipText}
                                  </span>
                                </Button>
                              </PopoverTrigger>
                            </Popover>
                          );
                        })()}

                        {/* GA4 toggle button */}
                        {(() => {
                          const ga4Connected = h.ga4EnabledLocal && h.gscConnected;
                          return (
                            <Button
                              variant="outline"
                              size="icon"
                              className={cn(
                                "h-8 w-8 relative group",
                                ga4Connected
                                  ? "border-emerald-500/50 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                                  : "text-muted-foreground"
                              )}
                              onClick={() => {
                                if (ga4Connected) {
                                  h.handleGa4ToggleLocal(false);
                                } else {
                                  h.handleGa4ToggleLocal(true);
                                }
                              }}
                              disabled={h.ga4TogglingLocal}
                            >
                              {h.ga4TogglingLocal ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Activity className="h-3.5 w-3.5" />
                              )}
                              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded bg-popover border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                GA4
                              </span>
                            </Button>
                          );
                        })()}


                        {!h.gscHasToken && !isMobile && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={h.gscConnecting}
                            onClick={h.handleConnectGsc}
                          >
                            {h.gscConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                            Search Console
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => navigate(`/audit-expert?url=${encodeURIComponent(`https://${h.currentSite!.domain}`)}&from=sites`)}
                        >
                          {h.language === 'fr' ? 'Auditer' : h.language === 'es' ? 'Auditar' : 'Audit'}
                        </Button>
                        {h.latestStats && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => navigate(`/app/conversion-optimizer?site=${h.currentSite!.id}`)}
                          >
                            UX
                          </Button>
                        )}
                        {h.latestStats && !isMobile && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={h.isLoadingAudit}
                            onClick={async () => {
                              h.setArchitectSiteId(h.currentSite!.id);
                              h.setIsLoadingAudit(true);
                              h.setArchitectAuditResult(null);
                              try {
                                const domainUrl = `https://${h.currentSite!.domain}`;
                                const cacheKey = `expert-audit:url="${domainUrl}"`;
                                const { data: cached } = await supabase
                                  .from('audit_cache')
                                  .select('result_data')
                                  .eq('cache_key', cacheKey)
                                  .gt('expires_at', new Date().toISOString())
                                  .maybeSingle();
                                if (cached?.result_data) {
                                  const parsed = cached.result_data as any;
                                  if (parsed?.success && parsed?.data) h.setArchitectAuditResult(parsed.data);
                                  else if (parsed?.url) h.setArchitectAuditResult(parsed);
                                }
                                if (!cached?.result_data) {
                                  const { data: rawData } = await supabase
                                    .from('audit_raw_data')
                                    .select('raw_payload')
                                    .eq('domain', h.currentSite!.domain)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                  if (rawData?.raw_payload) {
                                    const payload = rawData.raw_payload as any;
                                    if (payload?.data) h.setArchitectAuditResult(payload.data);
                                    else if (payload?.url) h.setArchitectAuditResult(payload);
                                  }
                                }
                              } catch (e) {
                                console.warn('Could not fetch latest audit for Architect:', e);
                              } finally {
                                h.setIsLoadingAudit(false);
                                h.setIsArchitectOpen(true);
                              }
                            }}
                          >
                            {h.isLoadingAudit && h.architectSiteId === h.currentSite!.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {h.language === 'fr' ? 'Optimiser' : h.language === 'es' ? 'Optimizar' : 'Optimize'}
                          </Button>
                        )}
                        {!h.isCollaborator && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-muted-foreground/80" onClick={() => h.handleRemoveSite(h.currentSite!.id, t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* KPI Cards */}
                    {(() => {
                      const defaultKpiOrder = ['performanceMobile', 'performanceDesktop', 'seoScore', 'geoScore', 'aiVisibility', 'citationRate', 'sentiment', 'semanticAuth', 'voiceShare'];
                      const kpiDefinitions: Record<string, { label: string; value: string; icon: ElementType; valueClassName?: string; tooltip?: string }> = {
                        performanceMobile: { label: t.performanceMobile, value: h.latestPerformance !== null ? `${Math.round(h.latestPerformance)}/100` : '—', icon: Gauge },
                        performanceDesktop: { label: t.performanceDesktop, value: h.latestPerformanceDesktop !== null ? `${Math.round(h.latestPerformanceDesktop)}/100` : '—', icon: Gauge },
                        seoScore: { label: t.seoScore, value: h.latestStats?.seo_score != null ? `${h.latestStats.seo_score}%` : '—', icon: Search },
                        geoScore: { label: t.geoScore, value: h.latestStats?.geo_score ? `${h.latestStats.geo_score}%` : '—', icon: Globe },
                        aiVisibility: { label: t.aiVisibility, value: h.latestAiVisibility != null ? `${Math.round(h.latestAiVisibility)}/100` : '—', icon: Eye, tooltip: 'Méthodologie :\nScore combiné et pondéré de votre visibilité globale sur les moteurs IA.' },
                        citationRate: { label: t.citationRate, value: h.latestStats?.llm_citation_rate ? `${Math.round(h.latestStats.llm_citation_rate)}%` : '—', icon: Brain, tooltip: 'Méthodologie :\nPourcentage brut et factuel — sur X prompts testés, combien de fois votre domaine a été explicitement cité dans la réponse du LLM.' },
                        sentiment: { label: t.sentiment, value: h.latestStats ? sentimentLabel(h.latestStats.ai_sentiment) : '—', icon: BarChart3, valueClassName: h.latestStats ? sentimentColor(h.latestStats.ai_sentiment) : '' },
                        semanticAuth: { label: t.semanticAuth, value: h.latestStats?.semantic_authority ? `${Math.round(Number(h.latestStats.semantic_authority))}/100` : '—', icon: TrendingUp, tooltip: 'Méthodologie :\nMoyenne pondérée par volume de recherche des positions SERP (DataForSEO) filtrées par pertinence avec la carte d\'identité du site (produits/services, secteur, audience cible).' },
                        voiceShare: { label: `${t.voiceShare} (estimation)`, value: h.latestStats?.voice_share ? `${Math.round(Number(h.latestStats.voice_share))}%` : '—', icon: BarChart3, tooltip: 'Méthodologie :\nScore pondéré incluant visibilité LLM (moyenne des citations), performance SERP (mots-clés Top 10) et volume de recherche (ETV normalisé).' },
                      };

                      const psiDualRefresh = async () => {
                        if (!h.currentSite) return;
                        const res = await supabase.functions.invoke('check-pagespeed', { body: { url: `https://${h.currentSite.domain}`, lang: h.language, dual: true } });
                        const mobile = res.data?.data?.mobile?.scores?.performance ?? res.data?.data?.scores?.performance ?? null;
                        const desktop = res.data?.data?.desktop?.scores?.performance ?? null;
                        if (mobile !== null) toast.success(`${t.performanceMobile}: ${Math.round(mobile)}/100`);
                        if (desktop !== null) toast.success(`${t.performanceDesktop}: ${Math.round(desktop)}/100`);
                        if (h.currentSite) await h.runStreamingAudit(h.currentSite);
                      };
                      const kpiRefreshMap: Record<string, () => Promise<void>> = {
                        performanceMobile: psiDualRefresh,
                        performanceDesktop: psiDualRefresh,
                        seoScore: async () => {
                          if (!h.currentSite) return;
                          const res = await supabase.functions.invoke('check-pagespeed', { body: { url: `https://${h.currentSite.domain}`, lang: h.language, dual: true } });
                          const score = res.data?.data?.mobile?.scores?.seo ?? res.data?.data?.scores?.seo ?? null;
                          if (score !== null) toast.success(`${t.seoScore}: ${score}%`);
                          if (h.currentSite) await h.runStreamingAudit(h.currentSite);
                        },
                        geoScore: async () => {
                          if (!h.currentSite) return;
                          const res = await supabase.functions.invoke('check-geo', { body: { url: `https://${h.currentSite.domain}`, lang: h.language } });
                          const score = res.data?.data?.totalScore ?? res.data?.data?.overallScore ?? 0;
                          toast.success(`${t.geoScore}: ${Math.round(score)}%`);
                          if (h.currentSite) await h.runStreamingAudit(h.currentSite);
                        },
                      };

                      return (
                        <SortableKPIGrid
                          kpiDefinitions={kpiDefinitions}
                          defaultOrder={defaultKpiOrder}
                          disabled={!h.latestStats}
                          onRefresh={h.latestStats ? kpiRefreshMap : undefined}
                        />
                      );
                    })()}

                    {/* Tabs: KPIs / Evolution */}
                    <Tabs defaultValue="kpis" className="space-y-4">
                      <TabsList>
                        <TabsTrigger value="kpis">{t.kpis}</TabsTrigger>
                        <TabsTrigger value="evolution">{t.evolution}</TabsTrigger>
                        <TabsTrigger value="competitors" className="gap-1.5" disabled={!(h.isAdmin || h.planType === 'agency_premium')}>
                          <Search className="h-3 w-3" />
                          {h.language === 'fr' ? 'Concurrence' : h.language === 'es' ? 'Competencia' : 'Competitors'}
                          {!(h.isAdmin || h.planType === 'agency_premium') && (
                            <Lock className="h-3 w-3 text-yellow-500" />
                          )}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="kpis" className="space-y-4">
                        {/* LLM Visibility Dashboard */}
                        <LLMVisibilityDashboard trackedSiteId={h.currentSite.id} domain={h.currentSite.domain} userId={h.user?.id || ''} />

                        {/* LLM Depth */}
                        <LLMDepthCard trackedSiteId={h.currentSite.id} domain={h.currentSite.domain} userId={h.user?.id || ''} key={`llm-depth-${h.currentSite.id}-${h.llmBenchmarkRefreshKey}`} />

                        {/* Fan-Out Radar */}
                        <FanOutRadarWidget trackedSiteId={h.currentSite.id} domain={h.currentSite.domain} />

                        {/* IAS — only if site is verified in GSC */}
                        {h.gscSiteVerified && (
                          <IASCard trackedSiteId={h.currentSite.id} domain={h.currentSite.domain} userId={h.user?.id || ''} isPremium={h.isAgencyPro} />
                        )}


                        {/* Keyword Cloud */}
                        {h.latestSerpData?.sample_keywords && (
                          <KeywordCloud keywords={h.latestSerpData.sample_keywords} />
                        )}

                        {/* Top Keywords */}
                        {h.latestSerpData?.sample_keywords && (
                          <TopKeywordsList keywords={h.latestSerpData.sample_keywords} />
                        )}

                        {/* Quick Wins */}
                        <QuickWinsCard trackedSiteId={h.currentSite.id} domain={h.currentSite.domain} userId={h.user?.id || ''} />
                      </TabsContent>
                      <TabsContent value="evolution" className="space-y-4">
                        {h.chartData.length > 0 ? (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={h.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                                    <YAxis className="text-xs" tick={{ fontSize: 10 }} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="seo" name={t.seoScore} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="geo" name={t.geoScore} stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="citation" name={t.citationRate} stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="performanceMobile" name={t.performanceMobile} stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={{ r: 3 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground text-sm">
                            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                            <p>{h.language === 'fr' ? 'Pas encore assez de données pour afficher une évolution.' : 'Not enough data yet to show evolution.'}</p>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="competitors" className="space-y-4">
                        <CompetitorTrackingTab
                          trackedSiteId={h.currentSite.id}
                          domain={h.currentSite.domain}
                          userId={h.user?.id || ''}
                          language={h.language}
                        />
                      </TabsContent>
                    </Tabs>

                    {/* GSC Section */}
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-semibold">Search Console</CardTitle>
                          {h.gscConnected && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {h.language === 'fr' ? 'Connecté' : 'Connected'}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {h.gscLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : h.gscData ? (
                          <div className="space-y-4">
                            {/* GSC controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex rounded-lg border bg-muted p-0.5 text-sm">
                                <button className={cn("px-3.5 py-2 rounded-md transition-colors flex items-center gap-1.5", h.gscDateMode === 'since' && "bg-background shadow-sm font-medium")} onClick={() => h.setGscDateMode('since')}>
                                  {h.language === 'fr' ? 'Depuis' : h.language === 'es' ? 'Desde' : 'Since'}
                                </button>
                                <button className={cn("px-3.5 py-2 rounded-md transition-colors", h.gscDateMode === 'range' && "bg-background shadow-sm font-medium")} onClick={() => h.setGscDateMode('range')}>
                                  {h.language === 'fr' ? 'Entre' : h.language === 'es' ? 'Entre' : 'Between'}
                                </button>
                              </div>
                              {h.gscDateMode === 'since' && (
                                <input type="date" value={format(h.gscSinceDate, 'yyyy-MM-dd')} min="2020-01-01" max={format(new Date(), 'yyyy-MM-dd')}
                                  onChange={(e) => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); const date = new Date(y, m - 1, d); if (!isNaN(date.getTime())) h.setGscSinceDate(date); }}
                                  className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer" />
                              )}
                              {h.gscDateMode === 'range' && (
                                <>
                                  <input type="date" value={format(h.gscRangeStart, 'yyyy-MM-dd')} min="2020-01-01" max={format(h.gscRangeEnd, 'yyyy-MM-dd')}
                                    onChange={(e) => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); const date = new Date(y, m - 1, d); if (!isNaN(date.getTime())) h.setGscRangeStart(date); }}
                                    className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer" />
                                  <span className="text-sm text-muted-foreground">→</span>
                                  <input type="date" value={format(h.gscRangeEnd, 'yyyy-MM-dd')} min={format(h.gscRangeStart, 'yyyy-MM-dd')} max={format(new Date(), 'yyyy-MM-dd')}
                                    onChange={(e) => { if (!e.target.value) return; const [y, m, d] = e.target.value.split('-').map(Number); const date = new Date(y, m - 1, d); if (!isNaN(date.getTime())) h.setGscRangeEnd(date); }}
                                    className="h-10 text-sm px-3.5 rounded-md border border-input bg-background text-foreground cursor-pointer" />
                                </>
                              )}
                              <div className="flex rounded-lg border bg-muted p-0.5 text-sm ml-auto">
                                {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                                  <button key={g} className={cn("px-3 py-2 rounded-md transition-colors", h.gscGranularity === g && "bg-background shadow-sm font-medium")} onClick={() => h.setGscGranularity(g)}>
                                    {g === 'daily' ? (h.language === 'fr' ? 'Jour' : h.language === 'es' ? 'Día' : 'Day')
                                      : g === 'weekly' ? (h.language === 'fr' ? 'Sem.' : h.language === 'es' ? 'Sem.' : 'Week')
                                      : (h.language === 'fr' ? 'Mois' : h.language === 'es' ? 'Mes' : 'Month')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* GSC KPI summary */}
                            <div className="grid grid-cols-4 gap-3">
                              <div className="rounded-lg border bg-card p-3 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick className="h-3 w-3" />{h.language === 'fr' ? 'Clics' : 'Clicks'}</div>
                                <p className="text-lg font-semibold text-primary">{h.gscData.total_clicks.toLocaleString()}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="h-3 w-3" />Impressions</div>
                                <p className="text-lg font-semibold text-accent-foreground">{h.gscData.total_impressions.toLocaleString()}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />{h.language === 'fr' ? 'Position moy.' : 'Avg. position'}</div>
                                <p className="text-lg font-semibold">{h.gscData.avg_position.toFixed(1)}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick className="h-3 w-3" />CTR</div>
                                <p className="text-lg font-semibold">
                                  {h.gscData.total_impressions > 0 ? ((h.gscData.total_clicks / h.gscData.total_impressions) * 100).toFixed(1) + '%' : '—'}
                                </p>
                              </div>
                            </div>

                            {/* GSC Chart */}
                            {(() => {
                               const chartRows = h.gscAggregatedRows.map(row => ({
                                date: h.gscGranularity === 'monthly' ? row.date : row.date.slice(5),
                                rawDate: row.date,
                                clicks: row.clicks,
                                impressions: row.impressions,
                              }));
                              return (
                                <div className="h-[18.5rem] w-[108%] -ml-[2%]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartRows} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                                      <defs>
                                        <linearGradient id="gscClicksStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="hsl(var(--primary))" /><stop offset="100%" stopColor="hsl(var(--primary))" /></linearGradient>
                                        <linearGradient id="gscClicksFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="gscImpStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="hsl(262, 83%, 58%)" /><stop offset="100%" stopColor="hsl(262, 83%, 58%)" /></linearGradient>
                                        <linearGradient id="gscImpFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.2} /><stop offset="100%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} /></linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                      <XAxis dataKey="date" className="text-xs" interval="preserveStartEnd" tick={false} />
                                      <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                      <Legend
                                        formatter={(value: string) => (<span style={{ color: 'hsl(var(--foreground))', fontSize: 18 }}>{value}</span>)}
                                        payload={[
                                          { value: h.language === 'fr' ? 'Clics' : 'Clicks', type: 'line', color: 'hsl(var(--primary))' },
                                          { value: 'Impressions', type: 'line', color: 'hsl(262, 83%, 58%)' },
                                        ]}
                                      />
                                      <Area type="monotone" dataKey="clicks" name={h.language === 'fr' ? 'Clics' : 'Clicks'} stroke="url(#gscClicksStroke)" fill="url(#gscClicksFill)" strokeWidth={2} />
                                      <Area type="monotone" dataKey="impressions" name="Impressions" stroke="url(#gscImpStroke)" fill="url(#gscImpFill)" strokeWidth={2} />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground text-sm">
                            <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                            <p>{h.language === 'fr' ? 'Aucune donnée Search Console disponible pour ce site.' : 'No Search Console data available for this site.'}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Smart Recommendations */}
                    <SmartRecommendationsPanel
                      trackedSiteId={h.currentSite.id}
                      userId={h.user?.id || ''}
                      language={h.language}
                      onAction={(rec) => {
                        if (rec.recommendation_key === 'connect_gsc') {
                          toast.info('Ouvrez l\'onglet Connecteurs pour lier GSC.');
                        } else if (rec.recommendation_key === 'identity_card') {
                          h.setShowIdentityModal(true);
                        } else if (rec.recommendation_key === 'autopilot') {
                          toast.info('Autopilote actif en arrière-plan.');
                        } else {
                          toast.info(rec.title);
                        }
                      }}
                    />

                    {/* SERP Ranking Banner */}
                    <SerpKpiBanner
                      data={h.latestSerpData}
                      previousIndexedPages={h.previousIndexedPages}
                      hideAvgPosition={!!h.gscData}
                      onRefresh={async () => {
                        if (!h.currentSite || !h.user || h.refreshingSerp) return;
                        h.setRefreshingSerp(true);
                        try {
                          const response = await supabase.functions.invoke('fetch-serp-kpis', {
                            body: { domain: h.currentSite.domain, url: `https://${h.currentSite.domain}` },
                          });
                          let serpData = response.data?.data;
                          if (response.error || !serpData) {
                            const { data: snapshot } = await supabase
                              .from('serp_snapshots')
                              .select('*')
                              .eq('tracked_site_id', h.currentSite.id)
                              .order('measured_at', { ascending: false })
                              .limit(1)
                              .maybeSingle();
                            if (snapshot) {
                              serpData = {
                                total_keywords: snapshot.total_keywords, avg_position: snapshot.avg_position,
                                homepage_position: snapshot.homepage_position, top_3: snapshot.top_3,
                                top_10: snapshot.top_10, top_50: snapshot.top_50, etv: snapshot.etv,
                                indexed_pages: snapshot.indexed_pages, sample_keywords: snapshot.sample_keywords,
                                measured_at: snapshot.measured_at,
                              };
                            }
                          }
                          if (!serpData) return;
                          const existingRaw = (h.latestStats as any)?.raw_data || {};
                          await supabase.from('user_stats_history').insert({
                            tracked_site_id: h.currentSite.id, user_id: h.user.id, domain: h.currentSite.domain,
                            seo_score: h.latestStats?.seo_score ?? null, geo_score: h.latestStats?.geo_score ?? null,
                            llm_citation_rate: h.latestStats?.llm_citation_rate ?? null, ai_sentiment: h.latestStats?.ai_sentiment ?? null,
                            semantic_authority: h.latestStats?.semantic_authority ?? null, voice_share: h.latestStats?.voice_share ?? null,
                            raw_data: { ...existingRaw, serpData },
                          });
                          await h.fetchStats();
                          toast.success(h.language === 'fr' ? 'Données SERP mises à jour' : 'SERP data updated');
                        } catch (err) {
                          console.warn('[SERP refresh] Error:', err);
                        } finally {
                          h.setRefreshingSerp(false);
                        }
                      }}
                      isRefreshing={h.refreshingSerp}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Site Modal */}
      <Dialog open={h.showAddModal} onOpenChange={h.setShowAddModal}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t.addSite}</DialogTitle>
            <DialogDescription>{t.addSiteDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
            <div className="flex gap-2">
              <Input
                placeholder={t.urlPlaceholder}
                value={h.newUrl}
                onChange={e => { h.setNewUrl(e.target.value); h.setValidationResult({ valid: false, checked: false }); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (!h.validationResult.checked) h.handleValidateUrl();
                    else if (h.validationResult.valid) h.handleAddSite(t);
                  }
                }}
                className={cn(
                  h.validationResult.checked && h.validationResult.valid && 'border-green-500 focus-visible:ring-green-500',
                  h.validationResult.checked && !h.validationResult.valid && !h.validationResult.suggestion && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {!h.validationResult.checked && (
                <Button variant="secondary" onClick={h.handleValidateUrl} disabled={h.validating || !h.newUrl.trim()} className="gap-2 shrink-0">
                  {h.validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {h.language === 'fr' ? 'Vérifier' : 'Verify'}
                </Button>
              )}
            </div>
            {h.validationResult.checked && h.validationResult.valid && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {h.language === 'fr' ? 'URL validée ✓' : 'URL validated ✓'}
              </div>
            )}
            {h.validationResult.checked && !h.validationResult.valid && h.validationResult.suggestion && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  {h.language === 'fr' ? 'URL inaccessible. Suggestion trouvée :' : 'URL unreachable. Suggestion found:'}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">{h.validationResult.suggestion}</code>
                  <Button size="sm" onClick={h.handleAcceptSuggestion} className="gap-1.5 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {h.language === 'fr' ? 'Utiliser' : 'Use'}
                  </Button>
                </div>
              </div>
            )}
            {h.validationResult.checked && !h.validationResult.valid && !h.validationResult.suggestion && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {h.language === 'fr' ? 'URL inaccessible. Vérifiez l\'adresse.' : 'URL unreachable. Check the address.'}
                </div>
                <Button variant="ghost" size="sm" onClick={() => h.setValidationResult({ valid: true, checked: true })} className="text-xs text-muted-foreground">
                  {h.language === 'fr' ? 'Ignorer et ajouter quand même' : 'Ignore and add anyway'}
                </Button>
              </div>
            )}
            <div className="flex justify-center">
              <Button onClick={() => h.handleAddSite(t)} disabled={h.adding || !h.newUrl.trim() || h.validating || (!h.validationResult.checked)} className="gap-2">
                {h.adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {h.adding ? t.adding : t.add}
              </Button>
            </div>
          </div>
          <div className="shrink-0 pt-3 border-t border-border">
            <div className="flex items-start gap-3">
              <Checkbox id="ga4-add-modal" checked={h.ga4EnabledLocal} disabled={h.ga4TogglingLocal} onCheckedChange={(checked) => h.handleGa4ToggleLocal(!!checked)} className="mt-0.5" />
              <div className="space-y-1">
                <label htmlFor="ga4-add-modal" className="text-sm font-medium cursor-pointer leading-none">
                  {h.language === 'en' ? 'Connect Google Analytics' : h.language === 'es' ? 'Conectar Google Analytics' : 'Connecter Google Analytics'}
                </label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {h.language === 'en' ? 'Anonymized data. GA4 helps us make more precise recommendations and improve your ROI.'
                    : h.language === 'es' ? 'Datos anonimizados. GA4 nos permite hacer recomendaciones más precisas y mejorar su ROI.'
                    : 'Données anonymisées. GA4 nous permet de vous faire des recommandations plus précises et d\'améliorer votre ROI.'}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WordPress Modal */}
      <Dialog open={h.showWpModal} onOpenChange={h.setShowWpModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col pr-10">
          <div className="flex-1 min-h-0">
            {(() => {
              const wpSite = h.sites.find(s => s.id === h.wpConnectSiteId);
              if (!wpSite) return null;
              return <WordPressConfigCard siteId={wpSite.id} siteDomain={wpSite.domain} siteApiKey={wpSite.api_key || ''} hasConfig={!!(wpSite.current_config && Object.keys(wpSite.current_config).length > 0)} />;
            })()}
          </div>
          <div className="shrink-0 pt-3 border-t border-border">
            <div className="flex items-start gap-3">
              <Checkbox id="ga4-wp-modal" checked={h.ga4EnabledLocal} disabled={h.ga4TogglingLocal} onCheckedChange={(checked) => h.handleGa4ToggleLocal(!!checked)} className="mt-0.5" />
              <div className="space-y-1">
                <label htmlFor="ga4-wp-modal" className="text-sm font-medium cursor-pointer leading-none flex items-center gap-2">
                  {h.language === 'en' ? 'Connect Google Analytics' : h.language === 'es' ? 'Conectar Google Analytics' : 'Connecter Google Analytics'}
                </label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {h.language === 'en' ? 'Anonymized data. GA4 helps us make more precise recommendations and improve your ROI.'
                    : h.language === 'es' ? 'Datos anonimizados. GA4 nos permite hacer recomendaciones más precisas y mejorar su ROI.'
                    : 'Données anonymisées. GA4 nous permet de vous faire des recommandations plus précises et d\'améliorer votre ROI.'}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Architect Modal */}
      {(() => {
        const archSite = h.sites.find(s => s.id === h.architectSiteId);
        if (!archSite) return null;
        return (
          <SmartConfigurator
            isOpen={h.isArchitectOpen}
            onClose={() => { h.setIsArchitectOpen(false); h.setArchitectSiteId(null); h.setArchitectAuditResult(null); }}
            technicalResult={h.architectAuditResult}
            strategicResult={h.architectAuditResult?.strategicAnalysis ? h.architectAuditResult : null}
            siteUrl={`https://${archSite.domain}`}
            siteName={archSite.site_name || archSite.domain}
            activeSiteId={archSite.id}
          />
        );
      })()}

      {/* Site Identity Modal */}
      {h.currentSite && (
        <SiteIdentityModal open={h.showIdentityModal} onOpenChange={h.setShowIdentityModal} site={h.currentSite} onUpdate={() => h.fetchSites()} />
      )}

    </div>
  );
}
