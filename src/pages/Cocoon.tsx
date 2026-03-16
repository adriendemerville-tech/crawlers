import { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCocoonTheme } from "@/hooks/useCocoonTheme";
import { CocoonForceGraph3D } from "@/components/Cocoon/CocoonForceGraph3D";
import { CocoonForceGraph } from "@/components/Cocoon/CocoonForceGraph";
import { CocoonNodePanel } from "@/components/Cocoon/CocoonNodePanel";
import { CocoonHelpModal } from "@/components/Cocoon/CocoonHelpModal";
import { CocoonAIChat } from "@/components/Cocoon/CocoonAIChat";
import { CocoonRecommendationHistory } from "@/components/Cocoon/CocoonRecommendationHistory";
import { CocoonTaskPlanModal } from "@/components/Cocoon/CocoonTaskPlanModal";
import { CocoonArchitectModal } from "@/components/Cocoon/CocoonArchitectModal";
import { CocoonAccessGate } from "@/components/Cocoon/CocoonAccessGate";
import { CocoonFilterSelector, CocoonFilters } from "@/components/Cocoon/CocoonFilterSelector";
import { Loader2, Eye, EyeOff, RefreshCw, Lock, ChevronDown, Crown, Star, CheckCircle2, AlertTriangle, Search, FileText, ArrowLeft, LayoutDashboard, ExternalLink, Sparkles, Layers, ClipboardList, Maximize, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const i18n = {
  fr: {
    title: "Cocoon — Architecture Sémantique | Crawlers.fr",
    metaDesc: "Visualisez l'architecture sémantique de votre site comme un organisme vivant. Analyse GEO, ROI prédictif et maillage intelligent.",
    accessTitle: "Accès Pro Agency",
    accessDesc: "Le module Cocoon est réservé aux abonnés Pro Agency. Visualisez l'architecture sémantique de votre site, optimisez votre maillage et prédisez le ROI de chaque page.",
    login: "Se connecter",
    discoverPro: "Découvrir Pro Agency",
    organism: "Organisme Vivant",
    selectSite: "Sélectionner un site",
    xray: "X-Ray",
    computing: "Calcul...",
    generate: "Générer",
    loading: "Chargement du graphe sémantique…",
    noGraph: "Aucun cocon généré",
    noGraphDesc: "Sélectionnez un site tracké puis cliquez sur \"Générer le Cocon\" pour construire l'architecture sémantique à partir de vos données de crawl.",
    errorTitle: "Erreur",
    errorCompute: "Erreur lors du calcul du cocon",
    errorGeneric: "Impossible de calculer le cocon sémantique",
    successTitle: "Cocon généré",
    successDesc: (nodes: number, clusters: number) => `${nodes} nœuds · ${clusters} clusters`,
    upsellTitle: "Cocoon · Organisme Vivant",
    upsellDesc: "Visualisez l'architecture sémantique de votre site, optimisez votre maillage et prédisez le ROI de chaque page avec le module Cocoon.",
    upsellFeatures: ['Audit expert illimité', 'Code correctif illimité', 'Cocoon sémantique illimité', 'Marque Blanche (White Label)'],
    upsellPrice: '59€',
    upsellPer: 'mois',
    upsellCta: "S'abonner",
    upsellRedirecting: 'Redirection…',
    prereqTitle: 'Actions requises',
    prereqCrawl: 'Crawl multi-pages',
    prereqAudit: 'Audit stratégique',
    prereqDesc: 'Pour générer le Cocoon sémantique, ces étapes doivent être complétées sur le site sélectionné.',
    prereqCrawlCta: 'Lancer un crawl',
    prereqAuditCta: 'Lancer un audit stratégique',
    prereqClose: 'Compris',
    refreshData: 'Actualiser data',
    analyzingData: 'Analyses data...',
    auditExpert: 'Audit Expert',
    crawlMulti: 'Crawl Multi-pages',
    console: 'Console',
  },
  en: {
    title: "Cocoon — Semantic Architecture | Crawlers.fr",
    metaDesc: "Visualize your site's semantic architecture as a living organism. GEO analysis, predictive ROI and smart internal linking.",
    accessTitle: "Pro Agency Access",
    accessDesc: "The Cocoon module is reserved for Pro Agency subscribers. Visualize your site's semantic architecture, optimize your internal linking and predict each page's ROI.",
    login: "Sign in",
    discoverPro: "Discover Pro Agency",
    organism: "Living Organism",
    selectSite: "Select a site",
    xray: "X-Ray",
    computing: "Computing...",
    generate: "Generate",
    loading: "Loading semantic graph…",
    noGraph: "No cocoon generated",
    noGraphDesc: "Select a tracked site then click \"Generate Cocoon\" to build the semantic architecture from your crawl data.",
    errorTitle: "Error",
    errorCompute: "Error computing the cocoon",
    errorGeneric: "Unable to compute the semantic cocoon",
    successTitle: "Cocoon generated",
    successDesc: (nodes: number, clusters: number) => `${nodes} nodes · ${clusters} clusters`,
    upsellTitle: "Cocoon · Living Organism",
    upsellDesc: "Visualize your site's semantic architecture, optimize internal linking and predict each page's ROI with the Cocoon module.",
    upsellFeatures: ['Unlimited expert audit', 'Unlimited corrective code', 'Unlimited semantic Cocoon', 'White Label branding'],
    upsellPrice: '€59',
    upsellPer: 'month',
    upsellCta: 'Subscribe',
    upsellRedirecting: 'Redirecting…',
    prereqTitle: 'Required actions',
    prereqCrawl: 'Multi-page crawl',
    prereqAudit: 'Strategic audit',
    prereqDesc: 'To generate the semantic Cocoon, these steps must be completed on the selected site.',
    prereqCrawlCta: 'Start a crawl',
    prereqAuditCta: 'Start a strategic audit',
    prereqClose: 'Got it',
    refreshData: 'Refresh data',
    analyzingData: 'Analyzing data...',
    auditExpert: 'Expert Audit',
    crawlMulti: 'Multi-page Crawl',
    console: 'Console',
  },
  es: {
    title: "Cocoon — Arquitectura Semántica | Crawlers.fr",
    metaDesc: "Visualice la arquitectura semántica de su sitio como un organismo vivo. Análisis GEO, ROI predictivo y enlazado inteligente.",
    accessTitle: "Acceso Pro Agency",
    accessDesc: "El módulo Cocoon está reservado para suscriptores Pro Agency. Visualice la arquitectura semántica de su sitio, optimice su enlazado interno y prediga el ROI de cada página.",
    login: "Iniciar sesión",
    discoverPro: "Descubrir Pro Agency",
    organism: "Organismo Vivo",
    selectSite: "Seleccionar un sitio",
    xray: "X-Ray",
    computing: "Calculando...",
    generate: "Generar",
    loading: "Cargando grafo semántico…",
    noGraph: "Ningún cocoon generado",
    noGraphDesc: "Seleccione un sitio rastreado y haga clic en \"Generar Cocoon\" para construir la arquitectura semántica a partir de sus datos de rastreo.",
    errorTitle: "Error",
    errorCompute: "Error al calcular el cocoon",
    errorGeneric: "No se pudo calcular el cocoon semántico",
    successTitle: "Cocoon generado",
    successDesc: (nodes: number, clusters: number) => `${nodes} nodos · ${clusters} clusters`,
    upsellTitle: "Cocoon · Organismo Vivo",
    upsellDesc: "Visualice la arquitectura semántica de su sitio, optimice su enlazado interno y prediga el ROI de cada página con el módulo Cocoon.",
    upsellFeatures: ['Auditoría experta ilimitada', 'Código correctivo ilimitado', 'Cocoon semántico ilimitado', 'Marca Blanca (White Label)'],
    upsellPrice: '59€',
    upsellPer: 'mes',
    upsellCta: 'Suscribirse',
    upsellRedirecting: 'Redirigiendo…',
    prereqTitle: 'Acciones requeridas',
    prereqCrawl: 'Crawl multi-página',
    prereqAudit: 'Auditoría estratégica',
    prereqDesc: 'Para generar el Cocoon semántico, estos pasos deben completarse en el sitio seleccionado.',
    prereqCrawlCta: 'Iniciar un crawl',
    prereqAuditCta: 'Iniciar una auditoría estratégica',
    prereqClose: 'Entendido',
    refreshData: 'Actualizar datos',
    analyzingData: 'Analizando datos...',
    auditExpert: 'Auditoría Experta',
    crawlMulti: 'Crawl Multi-página',
    console: 'Consola',
  },
};

/** Check if any tracked site has both a crawl and an expert audit */
async function findReadySite(sites: any[], userId: string) {
  for (const site of sites) {
    const [crawlRes, auditRes] = await Promise.all([
      supabase
        .from("site_crawls" as any)
        .select("id")
        .eq("domain", site.domain)
        .eq("user_id", userId)
        .limit(1),
      supabase
        .from("audits")
        .select("id")
        .eq("domain", site.domain)
        .limit(1),
    ]);
    if ((crawlRes.data?.length || 0) > 0 && (auditRes.data?.length || 0) > 0) {
      return site;
    }
  }
  return null;
}

export default function Cocoon() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  useCanonicalHreflang('/cocoon');
  const t = i18n[language] || i18n.fr;
  const { theme: cocoonTheme } = useCocoonTheme();

  const [trackedSites, setTrackedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodePickerCallback, setNodePickerCallback] = useState<((node: any) => void) | null>(null);
  const [isXRayMode, setIsXRayMode] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [graphContrast, setGraphContrast] = useState(100);
  const [colorIntensity, setColorIntensity] = useState(5);
  const [isComputing, setIsComputing] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [showTaskPlan, setShowTaskPlan] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [architectRecoText, setArchitectRecoText] = useState<string | undefined>();
  const [prereqStatus, setPrereqStatus] = useState<{ hasCrawl: boolean; hasAudit: boolean }>({ hasCrawl: true, hasAudit: true });
  const [truncationInfo, setTruncationInfo] = useState<{ truncated: boolean; total: number; used: number } | null>(null);
  const [autoLaunchDomain, setAutoLaunchDomain] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [waitingAuditUrl, setWaitingAuditUrl] = useState<string | null>(null);
  const [cocoonFilters, setCocoonFilters] = useState<CocoonFilters>({ visiblePageTypes: new Set<string>(), visibleJuiceTypes: new Set<string>(), showAllClusters: true });
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const autoLaunchTriggered = useRef(false);
  const externalClickTimestamp = useRef<number | null>(null);
  const waitingAuditNodeUrl = useRef<string | null>(null);

  // Sync selectedNode with latest nodes data after recompute
  useEffect(() => {
    if (selectedNode && nodes.length > 0) {
      const updated = nodes.find((n: any) => n.url === selectedNode.url);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedNode)) {
        setSelectedNode(updated);
      }
    }
  }, [nodes]);

  // Initialize filters when nodes change
  useEffect(() => {
    if (nodes.length > 0 && !filtersInitialized) {
      const pageTypes = new Set(nodes.map((n: any) => n.page_type || 'unknown'));
      const juiceTypes = new Set<string>();
      const maxAuth = Math.max(1, ...nodes.map((n: any) => n.page_authority ?? 0));
      const maxTraffic = Math.max(1, ...nodes.map((n: any) => n.traffic_estimate ?? 0));
      const homeNode = nodes.find((n: any) => n.page_type === 'homepage') || [...nodes].sort((a: any, b: any) => ((a as any).crawl_depth ?? 99) - ((b as any).crawl_depth ?? 99))[0];
      const homeId = homeNode?.id;
      for (const node of nodes) {
        for (const edge of ((node as any).similarity_edges || [])) {
          const targetNode = nodes.find((n: any) => n.url === edge.target_url);
          if (!targetNode) continue;
          const depthDelta = Math.abs(((node as any).crawl_depth ?? 0) - ((targetNode as any).crawl_depth ?? 0));
          const isHomeSrc = (node as any).id === homeId;
          const isHomeTgt = (targetNode as any).id === homeId;
          const avgAuth = (((node as any).page_authority ?? 0) + ((targetNode as any).page_authority ?? 0)) / 2;
          const avgTraffic = (((node as any).traffic_estimate ?? 0) + ((targetNode as any).traffic_estimate ?? 0)) / 2;
          let jt = 'semantic';
          if (depthDelta >= 1 && (isHomeSrc || isHomeTgt)) jt = 'hierarchy';
          else if (avgAuth / maxAuth > 0.5) jt = 'authority';
          else if (avgTraffic / maxTraffic > 0.4) jt = 'traffic';
          juiceTypes.add(jt);
        }
      }
      setCocoonFilters({ visiblePageTypes: pageTypes, visibleJuiceTypes: juiceTypes, showAllClusters: true });
      setFiltersInitialized(true);
    }
    if (nodes.length === 0) setFiltersInitialized(false);
  }, [nodes, filtersInitialized]);

  // Filtered nodes based on selected page types
  const filteredNodes = useMemo(() => {
    if (!filtersInitialized || cocoonFilters.visiblePageTypes.size === 0) return nodes;
    return nodes.filter((n: any) => cocoonFilters.visiblePageTypes.has(n.page_type || 'unknown'));
  }, [nodes, cocoonFilters.visiblePageTypes, filtersInitialized]);

  // Check access: Pro Agency or Admin
  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }

    const checkAccess = async () => {
      const [{ data: profile }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("plan_type").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);
      const allowed = ["agency_pro", "agency_premium"];
      setHasAccess(isAdmin || allowed.includes(profile?.plan_type || ""));
    };
    checkAccess();
  }, [user]);

  // Delayed upsell reveal for non-pro users
  useEffect(() => {
    if (hasAccess !== false) return;
    const timer = setTimeout(() => setShowUpsell(true), 5000);
    return () => clearTimeout(timer);
  }, [hasAccess]);

  // Read URL params on mount (autolaunch, fullscreen, daymode, site)
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('autolaunch');
    if (domain) {
      setAutoLaunchDomain(domain);
      navigate('/cocoon', { replace: true });
    }
    if (params.get('fullscreen') === '1') {
      setIsFullscreen(true);
    }
    // daymode param removed
    const siteParam = params.get('site');
    if (siteParam) {
      setSelectedSiteId(siteParam);
    }
  }, [navigate]);

  // Load tracked sites
  const autoReadyTriggered = useRef(false);
  useEffect(() => {
    if (!user || !hasAccess) return;

    const loadSites = async () => {
      const { data } = await supabase
        .from("tracked_sites")
        .select("id, domain, site_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTrackedSites(data || []);

      // Auto-select site matching autolaunch domain
      if (autoLaunchDomain && data?.length) {
        const match = data.find((s: any) => s.domain === autoLaunchDomain);
        if (match) {
          setSelectedSiteId(match.id);
        } else if (data[0]) {
          setSelectedSiteId(data[0].id);
        }
      } else if (data?.length && !autoReadyTriggered.current) {
        // Check which sites have both a crawl AND an expert audit → auto-select & auto-launch
        const readySite = await findReadySite(data, user.id);
        if (readySite) {
          autoReadyTriggered.current = true;
          setSelectedSiteId(readySite.id);
          setAutoLaunchDomain(readySite.domain);
        } else if (data[0]) {
          setSelectedSiteId(data[0].id);
        }
      } else if (data?.[0]) {
        setSelectedSiteId(data[0].id);
      }
    };
    loadSites();
  }, [user, hasAccess, autoLaunchDomain]);

  // Auto-launch cocoon 2s after site is selected (from autolaunch flow)
  useEffect(() => {
    if (!autoLaunchDomain || !selectedSiteId || autoLaunchTriggered.current) return;
    const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
    if (!selectedSite || selectedSite.domain !== autoLaunchDomain) return;

    autoLaunchTriggered.current = true;
    const timer = setTimeout(() => {
      handleCompute();
    }, 2000);
    return () => clearTimeout(timer);
  }, [autoLaunchDomain, selectedSiteId, trackedSites]);

  // Auto-compute in fullscreen mode when site is pre-selected
  const fullscreenTriggered = useRef(false);
  useEffect(() => {
    if (!isFullscreen || !selectedSiteId || !user || fullscreenTriggered.current || nodes.length > 0) return;
    fullscreenTriggered.current = true;
    const timer = setTimeout(() => handleCompute(), 500);
    return () => clearTimeout(timer);
  }, [isFullscreen, selectedSiteId, user, nodes.length]);
  // Auto-refresh: detect return from external audit/crawl tabs
  useEffect(() => {
    if (!user || !selectedSiteId) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const clickTs = externalClickTimestamp.current;
      if (!clickTs) return;

      // Must have been away at least 15s (realistic time to start an audit/crawl)
      const elapsed = Date.now() - clickTs;
      if (elapsed < 15_000) return;

      const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
      if (!selectedSite) return;

      // Wait 3s for DB to settle after tab focus
      await new Promise(r => setTimeout(r, 3000));

      // Check for new crawls or audits since click
      const since = new Date(clickTs).toISOString();
      const [crawlRes, auditRes] = await Promise.all([
        supabase
          .from("site_crawls" as any)
          .select("id", { count: "exact", head: true })
          .eq("domain", selectedSite.domain)
          .eq("user_id", user.id)
          .gte("created_at", since),
        supabase
          .from("audits")
          .select("id", { count: "exact", head: true })
          .eq("domain", selectedSite.domain)
          .eq("user_id", user.id)
          .gte("created_at", since),
      ]);

      const hasNewData = (crawlRes.count || 0) > 0 || (auditRes.count || 0) > 0;
      if (hasNewData) {
        externalClickTimestamp.current = null;
        setIsAutoRefreshing(true);
        await handleCompute();
        setIsAutoRefreshing(false);
        setWaitingAuditUrl(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, selectedSiteId, trackedSites]);

  // Load existing nodes for selected site
  useEffect(() => {
    if (!selectedSiteId) return;

    const loadNodes = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("semantic_nodes" as any)
        .select("*")
        .eq("tracked_site_id", selectedSiteId)
        .order("traffic_estimate", { ascending: false })
        .limit(500);

      if (!error && data) {
        setNodes(data);
      }
      setIsLoading(false);
    };
    loadNodes();
  }, [selectedSiteId]);

  // Trigger computation
  const handleCompute = async () => {
    if (!selectedSiteId || !user) return;

    // Find the domain for the selected site
    const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
    if (!selectedSite) return;

    setIsComputing(true);

    try {
      // Check prerequisite: crawl is required, audit is optional (used for enrichment only)
      const crawlRes = await supabase
        .from("site_crawls" as any)
        .select("id")
        .eq("domain", selectedSite.domain)
        .eq("user_id", user.id)
        .limit(1);

      const hasCrawl = (crawlRes.data?.length || 0) > 0;

      if (!hasCrawl) {
        setPrereqStatus({ hasCrawl, hasAudit: true });
        setShowPrereqModal(true);
        setIsComputing(false);
        return;
      }

      const resp = await supabase.functions.invoke("calculate-cocoon-logic", {
        body: { tracked_site_id: selectedSiteId },
      });

      if (resp.error) {
        toast({
          title: t.errorTitle,
          description: resp.error.message || t.errorCompute,
          variant: "destructive",
        });
      } else {
        const stats = resp.data?.stats;
        // Track truncation info
        if (stats?.truncated) {
          setTruncationInfo({ truncated: true, total: stats.total_crawl_pages, used: stats.nodes_count });
        } else {
          setTruncationInfo(null);
        }
        toast({
          title: t.successTitle,
          description: t.successDesc(stats?.nodes_count || 0, stats?.clusters_count || 0),
        });
        const { data } = await supabase
          .from("semantic_nodes" as any)
          .select("*")
          .eq("tracked_site_id", selectedSiteId)
          .order("traffic_estimate", { ascending: false })
          .limit(500);
        if (data) setNodes(data);
      }
    } catch (e) {
      toast({
        title: t.errorTitle,
        description: t.errorGeneric,
        variant: "destructive",
      });
    }

    setIsComputing(false);
  };

  return (
    <>
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
      </Helmet>

      {/* Access gate overlay for non-subscribers */}
      {hasAccess === false && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-md bg-black/30" />
          <div className="relative z-10 h-full">
            <CocoonAccessGate language={language} />
          </div>
        </div>
      )}

      <div className={`h-screen flex flex-col relative pt-2 sm:pt-4 overflow-hidden bg-[#0f0a1e]`}>

        {/* Top Bar */}
        {!isFullscreen && (
        <header className="shrink-0 backdrop-blur-xl px-2 sm:px-4 md:px-6 py-2 bg-[#0f0a1e]/80">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-y-2 gap-x-2">
            {/* Title */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse hidden sm:block" />
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-bold font-display tracking-tight leading-none text-white">
                  Cocoon <span className="text-[#fbbf24]">·</span> <span className="hidden xs:inline">{t.organism}</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-medium tracking-wider uppercase leading-none px-1 sm:px-1.5 py-0.5 rounded border text-white/30 bg-white/5 border-white/10">beta</span>
              </div>
            </div>

            {/* Site selector — centered on desktop, full row on mobile */}
            <div className="order-last sm:order-none w-full sm:w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2">
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-full sm:w-[240px] bg-white/5 border-[hsl(263,70%,20%)] text-white text-xs h-8">
                  <SelectValue placeholder={t.selectSite} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1035] border-[hsl(263,70%,20%)]">
                  {trackedSites.map((site) => (
                    <SelectItem key={site.id} value={site.id} className="text-white text-xs">
                      {site.site_name || site.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {new Set(nodes.map((n: any) => n.page_type || 'unknown')).size > 1 && (
                <CocoonFilterSelector
                  nodes={nodes}
                  filters={cocoonFilters}
                  onFiltersChange={setCocoonFilters}
                  language={language}
                  theme={cocoonTheme}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompute}
                disabled={isComputing || !selectedSiteId}
                className="h-7 sm:h-8 text-[10px] sm:text-xs border-[hsl(263,70%,20%)] bg-transparent text-white/60 hover:text-white gap-1 sm:gap-1.5 px-2 sm:px-3"
              >
                {(isComputing || isAutoRefreshing) ? <Loader2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 animate-spin" /> : <RefreshCw className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
                <span className="hidden sm:inline">{(isComputing || isAutoRefreshing) ? t.analyzingData : t.refreshData}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsXRayMode(!isXRayMode)}
                className={`h-7 sm:h-8 text-[10px] sm:text-xs border-[hsl(263,70%,20%)] px-2 sm:px-3 ${
                  isXRayMode
                    ? "bg-[#4c1d95]/50 text-[#fbbf24]"
                    : "bg-transparent text-white/60 hover:text-white"
                }`}
              >
                {isXRayMode ? <EyeOff className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1" /> : <Eye className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1" />}
                {t.xray}
              </Button>
              {/* Fullscreen in new tab */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedSiteId) params.set('site', selectedSiteId);
                  params.set('fullscreen', '1');
                  window.open(`/cocoon?${params.toString()}`, '_blank');
                }}
                className="h-7 sm:h-8 text-[10px] sm:text-xs border-[hsl(263,70%,20%)] bg-transparent text-white/60 hover:text-white px-2 sm:px-3"
              >
                <Maximize className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              </Button>
            </div>
          </div>
        </header>
        )}
        {/* Truncation banner */}
        {truncationInfo?.truncated && (
          <div className="shrink-0 px-4 py-2 bg-[#4c1d95]/30 border-b border-[hsl(263,70%,20%)] flex items-center gap-2 text-xs text-[#fbbf24]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {language === 'en'
                ? `Your site has ${truncationInfo.total} crawled pages — Cocoon analyzed the top ${truncationInfo.used} (sorted by depth) for optimal precision.`
                : language === 'es'
                  ? `Su sitio tiene ${truncationInfo.total} páginas rastreadas — Cocoon analizó las ${truncationInfo.used} principales (por profundidad) para una precisión óptima.`
                  : `Votre site contient ${truncationInfo.total} pages crawlées — Cocoon a analysé les ${truncationInfo.used} plus stratégiques (triées par profondeur) pour une précision optimale.`
              }
            </span>
          </div>
        )}

        {/* Main Graph */}
        <main className="flex-1 relative px-4 sm:px-6 md:px-10 lg:px-14 pt-6 sm:pt-8 lg:pt-12 pb-12 sm:pb-14 lg:pb-20 min-h-0">
          <div className="h-full rounded-xl overflow-hidden border relative border-[hsl(263,70%,20%)]" style={{ filter: `contrast(${graphContrast}%) brightness(${50 + graphContrast / 2}%)` }}>
            {/* 2D / 3D toggle */}
            {nodes.length > 0 && (
              <button
                onClick={() => setIs3DMode(v => !v)}
                className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 rounded-md backdrop-blur-md border text-[10px] font-mono transition-colors bg-black/50 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
              >
                <span className={is3DMode ? 'text-white/25' : 'text-white/70 font-semibold'}>2D</span>
                <span className="text-white/15">·</span>
                <span className={is3DMode ? 'text-white/70 font-semibold' : 'text-white/25'}>3D</span>
              </button>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#fbbf24]" />
                  <p className="text-white/40 text-sm">{t.loading}</p>
                </div>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-[#4c1d95]/20 flex items-center justify-center mx-auto border border-[#4c1d95]/15">
                    <RefreshCw className="w-8 h-8 text-[#a78bfa]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{t.noGraph}</h2>
                  <p className="text-white/40 text-sm">{t.noGraphDesc}</p>
                </div>
              </div>
            ) : is3DMode ? (
              <CocoonForceGraph3D
                nodes={filteredNodes}
                selectedNodeId={selectedNode?.id || null}
                onNodeSelect={(node) => {
                  if (nodePickerCallback && node) {
                    nodePickerCallback(node);
                    setNodePickerCallback(null);
                  } else {
                    setSelectedNode(node);
                  }
                }}
                isXRayMode={isXRayMode}
                isPickingMode={!!nodePickerCallback}
                particlesEnabled={particlesEnabled}
                nodeColors={cocoonTheme.nodeColors}
                particleColors={cocoonTheme.particleColors}
                haloColors={cocoonTheme.haloColors}
                showClusters={cocoonFilters.showAllClusters}
                visibleJuiceTypes={cocoonFilters.visibleJuiceTypes}
                isDayMode={false}
                colorIntensity={colorIntensity}
              />
            ) : (
              <CocoonForceGraph
                nodes={filteredNodes}
                selectedNodeId={selectedNode?.id || null}
                onNodeSelect={(node) => {
                  if (nodePickerCallback && node) {
                    nodePickerCallback(node);
                    setNodePickerCallback(null);
                  } else {
                    setSelectedNode(node);
                  }
                }}
                isXRayMode={isXRayMode}
                isPickingMode={!!nodePickerCallback}
                particlesEnabled={particlesEnabled}
                isDayMode={false}
              />
            )}

            {/* Particle Legend — bottom-left */}
            {nodes.length > 0 && (
              <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 backdrop-blur-md bg-black/50 border border-white/10 rounded-lg px-3 py-2">
                {Object.entries(cocoonTheme.particleColors).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-[10px] text-white/70 capitalize">{
                      { authority: "Autorité", semantic: "Sémantique", traffic: "Trafic", hierarchy: "Hiérarchie" }[key] || key
                    }</span>
                  </div>
                ))}
              </div>
            )}

            {/* Controls — right side */}
            {nodes.length > 0 && (
              <div className="absolute top-3 right-3 z-20 flex flex-col items-center gap-4 backdrop-blur-md bg-black/50 border border-white/10 rounded-lg px-2 py-3">
                {/* Contrast Slider */}
                <div className="flex flex-col items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-white/40" />
                  <div className="h-20">
                    <Slider
                      orientation="vertical"
                      min={50}
                      max={200}
                      step={5}
                      value={[graphContrast]}
                      onValueChange={([v]) => setGraphContrast(v)}
                      className="h-full [&_[data-orientation=vertical]]:w-1.5"
                    />
                  </div>
                  <span className="text-[9px] text-white/30 font-mono">{graphContrast}%</span>
                </div>

                <div className="w-full h-px bg-white/10" />

                {/* Color Intensity Slider */}
                <div className="flex flex-col items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400/70" />
                  <div className="h-20">
                    <Slider
                      orientation="vertical"
                      min={0}
                      max={10}
                      step={0.1}
                      value={[colorIntensity]}
                      onValueChange={([v]) => setColorIntensity(v)}
                      className="h-full [&_[data-orientation=vertical]]:w-1.5"
                    />
                  </div>
                  <span className="text-[9px] text-white/30 font-mono">{colorIntensity.toFixed(1)}</span>
                </div>
              </div>
            )}

            {/* Side Panel */}
            {selectedNode && (
              <CocoonNodePanel
                node={selectedNode}
                onClose={() => { setSelectedNode(null); setWaitingAuditUrl(null); }}
                onRefresh={() => handleCompute()}
                onAuditLaunch={() => {
                  externalClickTimestamp.current = Date.now();
                  setWaitingAuditUrl(selectedNode.url);
                }}
                isWaitingAudit={waitingAuditUrl === selectedNode.url}
              />
            )}
          </div>

          {/* Legend — dynamic, based on actual node types */}
          {nodes.length > 0 && (() => {
            const typeColorMap: Record<string, { color: string; label: Record<string, string> }> = {
              homepage: { color: '#fbbf24', label: { fr: 'Accueil', en: 'Home', es: 'Inicio' } },
              blog: { color: '#a78bfa', label: { fr: 'Blog', en: 'Blog', es: 'Blog' } },
              produit: { color: '#34d399', label: { fr: 'Produit', en: 'Product', es: 'Producto' } },
              'catégorie': { color: '#60a5fa', label: { fr: 'Catégorie', en: 'Category', es: 'Categoría' } },
              faq: { color: '#fb923c', label: { fr: 'FAQ', en: 'FAQ', es: 'FAQ' } },
              guide: { color: '#c084fc', label: { fr: 'Guide', en: 'Guide', es: 'Guía' } },
              contact: { color: '#f472b6', label: { fr: 'Contact', en: 'Contact', es: 'Contacto' } },
              tarifs: { color: '#facc15', label: { fr: 'Tarifs', en: 'Pricing', es: 'Precios' } },
              'légal': { color: '#94a3b8', label: { fr: 'Légal', en: 'Legal', es: 'Legal' } },
              'à propos': { color: '#67e8f9', label: { fr: 'À propos', en: 'About', es: 'Acerca de' } },
              page: { color: '#8b5cf6', label: { fr: 'Page', en: 'Page', es: 'Página' } },
            };
            const presentTypes = new Set(nodes.map((n: any) => n.page_type));
            const legendItems = Object.entries(typeColorMap).filter(([type]) => presentTypes.has(type));

            return (
              <div
                className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 px-1 flex-wrap opacity-0 animate-fade-in"
                style={{ animationDelay: '1.2s', animationFillMode: 'forwards' }}
              >
                {legendItems.map(([type, { color, label }]) => (
                  <div key={type} className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] sm:text-xs text-white/50">{label[language] || label.fr}</span>
                  </div>
                ))}
                <span className="mx-0.5 sm:mx-1 hidden sm:inline text-white/20">|</span>
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded" />
                  <span className="text-[10px] text-white/40">↓ {language === 'en' ? 'downstream' : language === 'es' ? 'descendente' : 'descendant'}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#60a5fa] to-[#22d3ee] rounded" />
                  <span className="text-[10px] text-white/40">↑ {language === 'en' ? 'upstream' : language === 'es' ? 'ascendente' : 'ascendant'}</span>
                </div>
                <span className="text-[9px] sm:text-xs ml-auto hidden sm:inline text-white/30">⌂ = Home · {language === 'en' ? 'Size ∝ depth' : language === 'es' ? 'Tamaño ∝ profundidad' : 'Taille ∝ profondeur'}</span>
                <a
                  href={(() => {
                    const domain = trackedSites.find(s => s.id === selectedSiteId)?.domain;
                    return domain ? `https://crawlers.fr/site-crawl?url=${encodeURIComponent(domain)}` : 'https://crawlers.fr/site-crawl';
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto sm:ml-2 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] transition-colors border bg-[#a855f7]/10 border-[#a855f7]/25 text-[#c084fc] hover:bg-[#a855f7]/20"
                >
                  <FileText className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">{t.crawlMulti}</span>
                  <ExternalLink className="w-2 h-2" />
                </a>
                <a
                  href={(() => {
                    const nodeUrl = selectedNode?.url;
                    const domain = trackedSites.find(s => s.id === selectedSiteId)?.domain;
                    const urlParam = nodeUrl || domain;
                    return urlParam ? `/audit-expert?url=${encodeURIComponent(urlParam)}` : '/audit-expert';
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] transition-colors border ml-0.5 sm:ml-1 bg-[#3b82f6]/10 border-[#3b82f6]/25 text-[#60a5fa] hover:bg-[#3b82f6]/20"
                >
                  <Search className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">{t.auditExpert}</span>
                  <ExternalLink className="w-2 h-2" />
                </a>
              </div>
            );
          })()}
        </main>

        {/* Bottom bar: Console left, AI Chat center-left, nav buttons right */}
        {!isFullscreen && (
        <div className="shrink-0 px-3 sm:px-4 md:px-6 py-9 flex items-end gap-2 sm:gap-4 flex-wrap">
          {/* Console button — bottom left */}
          <button
            onClick={() => navigate('/console')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors text-[10px] sm:text-xs font-medium backdrop-blur-md shrink-0 ml-2 sm:ml-4"
          >
            <ArrowLeft className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            <span className="hidden xs:inline">{t.console}</span>
          </button>

          {/* AI Chat — shifted right */}
          {hasAccess && nodes.length > 0 && (
            <div className="relative">
              <CocoonAIChat
                nodes={nodes}
                selectedNodeId={selectedNode?.id}
                onRequestNodePick={(cb) => setNodePickerCallback(() => cb)}
                onCancelPick={() => setNodePickerCallback(null)}
                trackedSiteId={selectedSiteId}
                domain={trackedSites.find(s => s.id === selectedSiteId)?.domain || ''}
              />
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Task Plan button — bottom right */}
          {hasAccess && selectedSiteId && (
            <button
              onClick={() => setShowTaskPlan(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 backdrop-blur-md transition-all shrink-0"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">{language === 'en' ? 'Tasks' : language === 'es' ? 'Tareas' : 'Tâches'}</span>
            </button>
          )}

          {/* Recommendation History — bottom right */}
          {hasAccess && selectedSiteId && (
            <div className="relative shrink-0 mr-2 sm:mr-4">
              <CocoonRecommendationHistory
                trackedSiteId={selectedSiteId}
                domain={trackedSites.find(s => s.id === selectedSiteId)?.domain || ''}
                onAddToTaskPlan={async (title, recoId) => {
                  if (!user) return;
                  const { supabase: sb } = await import('@/integrations/supabase/client');
                  await sb.from('cocoon_tasks').insert({
                    tracked_site_id: selectedSiteId,
                    user_id: user.id,
                    title,
                    status: 'todo',
                    priority: 'medium',
                    source_recommendation_id: recoId,
                  });
                  toast({ title: language === 'en' ? 'Task added' : language === 'es' ? 'Tarea añadida' : 'Tâche ajoutée' });
                  setShowTaskPlan(true);
                }}
                onGenerateFix={(recoText) => {
                  setArchitectRecoText(recoText);
                  setShowArchitect(true);
                }}
              />
            </div>
          )}
        </div>
        )}

        {hasAccess && selectedSiteId && (
          <CocoonTaskPlanModal
            open={showTaskPlan}
            onOpenChange={setShowTaskPlan}
            trackedSiteId={selectedSiteId}
            domain={trackedSites.find(s => s.id === selectedSiteId)?.domain || ''}
          />
        )}

        {hasAccess && selectedSiteId && (
          <CocoonArchitectModal
            open={showArchitect}
            onOpenChange={setShowArchitect}
            domain={trackedSites.find(s => s.id === selectedSiteId)?.domain || ''}
            trackedSiteId={selectedSiteId}
            recommendationText={architectRecoText}
          />
        )}

        <Dialog open={showPrereqModal} onOpenChange={setShowPrereqModal}>
          <DialogContent className="bg-[#1a1035] border-[hsl(263,70%,20%)] text-white max-w-md p-0 overflow-hidden">
            <div className="p-8 space-y-6">
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20">
                    <AlertTriangle className="h-5 w-5 text-[#fbbf24]" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-white tracking-tight">
                    {t.prereqTitle}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/50 text-sm leading-relaxed pt-1">
                  {t.prereqDesc}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {/* Crawl status */}
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  prereqStatus.hasCrawl
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${prereqStatus.hasCrawl ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <Search className={`h-4 w-4 ${prereqStatus.hasCrawl ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <span className="font-medium text-[15px] tracking-tight">{t.prereqCrawl}</span>
                  </div>
                  {prereqStatus.hasCrawl ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      onClick={() => {
                        const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
                        const domain = selectedSite?.domain || '';
                        setShowPrereqModal(false);
                        navigate(`/site-crawl${domain ? `?url=${encodeURIComponent(domain)}&from=cocoon` : '?from=cocoon'}`);
                      }}
                    >
                      {t.prereqCrawlCta}
                    </Button>
                  )}
                </div>

                {/* Audit status */}
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  prereqStatus.hasAudit
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${prereqStatus.hasAudit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <FileText className={`h-4 w-4 ${prereqStatus.hasAudit ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <span className="font-medium text-[15px] tracking-tight">{t.prereqAudit}</span>
                  </div>
                  {prereqStatus.hasAudit ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      onClick={() => {
                        const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
                        const domain = selectedSite?.domain || '';
                        setShowPrereqModal(false);
                        navigate(`/audit-expert${domain ? `?url=${encodeURIComponent(domain)}&from=cocoon` : '?from=cocoon'}`);
                      }}
                    >
                      {t.prereqAuditCta}
                    </Button>
                  )}
                </div>
              </div>

              <Button
                className="w-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                variant="outline"
                onClick={() => setShowPrereqModal(false)}
              >
                {t.prereqClose}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
