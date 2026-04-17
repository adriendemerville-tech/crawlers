import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useCocoonTheme } from "@/hooks/useCocoonTheme";
import { CocoonForceGraph3D } from "@/components/Cocoon/CocoonForceGraph3D";
import { CocoonForceGraph } from "@/components/Cocoon/CocoonForceGraph";
import { CocoonRadialGraph } from "@/components/Cocoon/CocoonRadialGraph";
import { CocoonNodePanel } from "@/components/Cocoon/CocoonNodePanel";
import { CocoonHelpModal } from "@/components/Cocoon/CocoonHelpModal";
import { CocoonAIChat } from "@/components/Cocoon/CocoonAIChat";
import { CocoonRecommendationHistory } from "@/components/Cocoon/CocoonRecommendationHistory";
import { CocoonTaskPlanModal } from "@/components/Cocoon/CocoonTaskPlanModal";
import { CocoonArchitectModal } from "@/components/Cocoon/CocoonArchitectModal";
import { CocoonAccessGate } from "@/components/Cocoon/CocoonAccessGate";
import { CocoonBulkAutoLinking } from "@/components/Cocoon/CocoonBulkAutoLinking";
import { CocoonFilterSelector, CocoonFilters } from "@/components/Cocoon/CocoonFilterSelector";
import { CocoonOnboardingStepper, shouldShowOnboarding, incrementCocoonVisit } from "@/components/Cocoon/CocoonOnboardingStepper";
import { AnimatePresence } from "framer-motion";
import { Loader2, Eye, EyeOff, RefreshCw, Lock, ChevronDown, Crown, Star, CheckCircle2, AlertTriangle, Search, FileText, ArrowLeft, LayoutDashboard, ExternalLink, Layers, ClipboardList, Maximize, SlidersHorizontal, Settings2, FileBarChart, Wand2 } from "lucide-react";
import { generateCocoonReport } from "@/components/Cocoon/CocoonReportGenerator";
import { useSaveReport } from "@/hooks/useSaveReport";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CocoonSiteSelector } from "@/components/Cocoon/CocoonSiteSelector";
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
    upsellPrice: '29€',
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
    generateGraph: 'Générer le graph',
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
    upsellPrice: '€29',
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
    generateGraph: 'Generate graph',
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
    upsellPrice: '29€',
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
    generateGraph: 'Generar el gráfico',
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
        .eq("user_id", userId)
        .limit(1),
    ]);
    if ((crawlRes.data?.length || 0) > 0 && (auditRes.data?.length || 0) > 0) {
      return site;
    }
  }
  return null;
}

function CocoonContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  useCanonicalHreflang('/cocoon');
  const t = i18n[language] || i18n.fr;
  const { theme: cocoonTheme } = useCocoonTheme();
  const { saveReport } = useSaveReport();
  // cocoonExpanded handled by AISidebarPageWrapper (paddingLeft) — no double offset here

  const [trackedSites, setTrackedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodePickerCallback, setNodePickerCallback] = useState<((node: any) => void) | null>(null);
  const [isXRayMode, setIsXRayMode] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'force' | 'radial' | '3d'>('force');
  const [graphContrast, setGraphContrast] = useState(100);
  const [colorIntensity, setColorIntensity] = useState(5);
  const [bgWarmth, setBgWarmth] = useState(0);
  const [linkThickness, setLinkThickness] = useState(1);
  const [bgColor, setBgColor] = useState(0); // -10=black, 0=night blue, 10=white
  const [isComputing, setIsComputing] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [showTaskPlan, setShowTaskPlan] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [showBulkAutoLink, setShowBulkAutoLink] = useState(false);
  const [hasCmsConnection, setHasCmsConnection] = useState(false);
  const [architectRecoText, setArchitectRecoText] = useState<string | undefined>();
  const [prereqStatus, setPrereqStatus] = useState<{ hasCrawl: boolean; hasAudit: boolean }>({ hasCrawl: true, hasAudit: true });
  const [truncationInfo, setTruncationInfo] = useState<{ truncated: boolean; total: number; used: number } | null>(null);
  const [autoLaunchDomain, setAutoLaunchDomain] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [waitingAuditUrl, setWaitingAuditUrl] = useState<string | null>(null);
  const [cocoonFilters, setCocoonFilters] = useState<CocoonFilters>({ visiblePageTypes: new Set<string>(), visibleJuiceTypes: new Set<string>(), visibleLinkDirections: new Set(['descending', 'ascending', 'lateral']), visibleClusters: null, showAllClusters: true, showParticles: true, showFanBeams: false, hideNoIndex: false });
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fanBeamLegend, setFanBeamLegend] = useState<{ id: string; name: string; color: string; nodeCount: number }[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const autoLaunchTriggered = useRef(false);
  const externalClickTimestamp = useRef<number | null>(null);
  const waitingAuditNodeUrl = useRef<string | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);

  // Increment cocoon visit counter on mount
  useEffect(() => { incrementCocoonVisit(); }, []);

  // Sync selectedNode with latest nodes data after recompute
  useEffect(() => {
    if (selectedNode && nodes.length > 0) {
      const updated = nodes.find((n: any) => n.url === selectedNode.url);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedNode)) {
        setSelectedNode(updated);
      }
    }
  }, [nodes]);

  // Reset filters & check CMS when site changes
  useEffect(() => {
    setFiltersInitialized(false);
    setCocoonFilters({ visiblePageTypes: new Set<string>(), visibleJuiceTypes: new Set<string>(), visibleLinkDirections: new Set(['descending', 'ascending', 'lateral']), visibleClusters: null, showAllClusters: true, showParticles: true, showFanBeams: false, hideNoIndex: false });
    setHasCmsConnection(false);
    if (selectedSiteId) {
      supabase.from('cms_connections_public' as any).select('id').eq('tracked_site_id', selectedSiteId).eq('status', 'active').limit(1).then(({ data }) => {
        setHasCmsConnection(!!(data && data.length > 0));
      });
    }
  }, [selectedSiteId]);

  // Initialize filters when nodes change — always re-init on new node set
  const nodesFingerprint = useMemo(() => nodes.map((n: any) => n.id).sort().join(','), [nodes]);
  useEffect(() => {
    if (nodes.length > 0) {
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
      setCocoonFilters({ visiblePageTypes: pageTypes, visibleJuiceTypes: juiceTypes, visibleLinkDirections: new Set(['descending', 'ascending', 'lateral']), visibleClusters: null, showAllClusters: true, showParticles: true, showFanBeams: false, hideNoIndex: false });
      setFiltersInitialized(true);
    } else {
      setFiltersInitialized(false);
    }
  }, [nodesFingerprint]);

  // Filtered nodes based on selected page types + noindex filter + cluster filter
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (filtersInitialized && cocoonFilters.visiblePageTypes.size > 0) {
      result = result.filter((n: any) => cocoonFilters.visiblePageTypes.has(n.page_type || 'unknown'));
    }
    if (cocoonFilters.hideNoIndex) {
      result = result.filter((n: any) => n._is_noindex !== true);
    }
    if (cocoonFilters.visibleClusters !== null) {
      result = result.filter((n: any) => {
        const cId = String(n.cluster_id || n.cluster || '');
        return cId && cocoonFilters.visibleClusters!.has(cId);
      });
    }
    return result;
  }, [nodes, cocoonFilters.visiblePageTypes, cocoonFilters.hideNoIndex, cocoonFilters.visibleClusters, filtersInitialized]);

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
  }, [user?.id]);

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
      navigate('/app/cocoon', { replace: true });
    }
    if (params.get('fullscreen') === '1') {
      setIsFullscreen(true);
    }
    // Restore settings from URL params (fullscreen sync)
    if (params.get('bgColor')) setBgColor(Number(params.get('bgColor')));
    if (params.get('bgWarmth')) setBgWarmth(Number(params.get('bgWarmth')));
    if (params.get('contrast')) setGraphContrast(Number(params.get('contrast')));
    if (params.get('halo')) setColorIntensity(Number(params.get('halo')));
    if (params.get('thickness')) setLinkThickness(Number(params.get('thickness')));
    const vmParam = params.get('viewMode');
    if (vmParam === 'force' || vmParam === 'radial' || vmParam === '3d') setViewMode(vmParam);
    // daymode param removed
    const siteParam = params.get('site');
    if (siteParam) {
      setSelectedSiteId(siteParam);
    }
  }, [navigate]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (settingsPanelRef.current && target && !settingsPanelRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  // Load tracked sites — only on first mount or when user id changes (not on object ref change)
  const autoReadyTriggered = useRef(false);
  const sitesLoadedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !hasAccess) return;
    // Prevent re-running if we already loaded sites for this user
    if (sitesLoadedForUser.current === user.id && trackedSites.length > 0) return;

    const loadSites = async () => {
      sitesLoadedForUser.current = user.id;
      const { data } = await supabase
        .from("tracked_sites")
        .select("id, domain, site_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTrackedSites(data || []);

      // Auto-select site matching autolaunch domain
      if (autoLaunchDomain && data?.length) {
        const normalize = (d: string) => d.replace(/^www\./, '').toLowerCase();
        const match = data.find((s: any) => normalize(s.domain) === normalize(autoLaunchDomain));
        if (match) {
          setSelectedSiteId(match.id);
        } else {
          // Domain not tracked yet — auto-create tracked site for seamless flow
          const { data: newSite } = await supabase
            .from('tracked_sites')
            .insert({ user_id: user.id, domain: autoLaunchDomain })
            .select('id')
            .single();
          if (newSite) {
            setTrackedSites(prev => [{ id: newSite.id, domain: autoLaunchDomain, site_name: null }, ...prev]);
            setSelectedSiteId(newSite.id);
          } else if (data[0]) {
            setSelectedSiteId(data[0].id);
          }
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
  }, [user?.id, hasAccess, autoLaunchDomain]);

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

  // Compute background CSS color from bgColor slider (-10=black, 0=night blue, 10=white)
  const computedBgColor = useMemo(() => {
    const nightBlue = { r: 15, g: 10, b: 30 }; // #0f0a1e
    if (bgColor <= 0) {
      // Interpolate from black (r=0,g=0,b=0) at -10 to nightBlue at 0
      const t = (bgColor + 10) / 10;
      return `rgb(${Math.round(nightBlue.r * t)},${Math.round(nightBlue.g * t)},${Math.round(nightBlue.b * t)})`;
    } else {
      // Interpolate from nightBlue at 0 to white (255,255,255) at 10
      const t = bgColor / 10;
      return `rgb(${Math.round(nightBlue.r + (255 - nightBlue.r) * t)},${Math.round(nightBlue.g + (255 - nightBlue.g) * t)},${Math.round(nightBlue.b + (255 - nightBlue.b) * t)})`;
    }
  }, [bgColor]);

  // BroadcastChannel: send settings from main → fullscreen, receive in fullscreen
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('cocoon-settings');
    if (isFullscreen) {
      // Listen for updates
      channel.onmessage = (e) => {
        const s = e.data;
        if (s.bgColor !== undefined) setBgColor(s.bgColor);
        if (s.bgWarmth !== undefined) setBgWarmth(s.bgWarmth);
        if (s.graphContrast !== undefined) setGraphContrast(s.graphContrast);
        if (s.colorIntensity !== undefined) setColorIntensity(s.colorIntensity);
        if (s.linkThickness !== undefined) setLinkThickness(s.linkThickness);
        if (s.viewMode) setViewMode(s.viewMode);
      };
    }
    return () => channel.close();
  }, [isFullscreen]);

  // Broadcast settings changes (only from main window)
  useEffect(() => {
    if (isFullscreen || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('cocoon-settings');
    channel.postMessage({ bgColor, bgWarmth, graphContrast, colorIntensity, linkThickness, viewMode });
    channel.close();
  }, [isFullscreen, bgColor, bgWarmth, graphContrast, colorIntensity, linkThickness, viewMode]);
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

    // Clear previous graph state when switching sites
    setNodes([]);
    setSelectedNode(null);

    const loadNodes = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("semantic_nodes" as any)
        .select("*")
        .eq("tracked_site_id", selectedSiteId)
        .order("traffic_estimate", { ascending: false })
        .limit(500);

      if (!error && data && data.length > 0) {
        // Enrich nodes with is_indexable from crawl_pages
        const crawlPageIds = data.map((n: any) => n.crawl_page_id).filter(Boolean);
        let noIndexSet = new Set<string>();
        if (crawlPageIds.length > 0) {
          const { data: crawlPages } = await supabase
            .from("crawl_pages" as any)
            .select("id, is_indexable, has_noindex")
            .in("id", crawlPageIds);
          if (crawlPages) {
            for (const cp of crawlPages as any[]) {
              if (cp.is_indexable === false || cp.has_noindex === true) {
                noIndexSet.add(cp.id);
              }
            }
          }
        }
        const enriched = data.map((n: any) => ({
          ...n,
          _is_noindex: n.crawl_page_id ? noIndexSet.has(n.crawl_page_id) : false,
        }));
        setNodes(enriched);
      } else if (!error) {
        setNodes([]);
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
      const normDomain = selectedSite.domain?.replace(/^www\./, '').toLowerCase();
      const crawlRes = await supabase
        .from("site_crawls" as any)
        .select("id, domain")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50);

      const hasCrawl = (crawlRes.data || []).some((c: any) => 
        c.domain?.replace(/^www\./, '').toLowerCase() === normDomain
      );

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

        // Run PageRank to compute internal_links_in (otherwise all pages show 0 inbound links)
        try {
          await supabase.functions.invoke("calculate-internal-pagerank", {
            body: { tracked_site_id: selectedSiteId },
          });
        } catch (prErr) {
          console.warn("PageRank calculation failed (non-blocking):", prErr);
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
        if (data && data.length > 0) {
          // Enrich with noindex info
          const cpIds = data.map((n: any) => n.crawl_page_id).filter(Boolean);
          let niSet = new Set<string>();
          if (cpIds.length > 0) {
            const { data: cps } = await supabase.from("crawl_pages" as any).select("id, is_indexable, has_noindex").in("id", cpIds);
            if (cps) {
              for (const cp of cps as any[]) {
                if (cp.is_indexable === false || cp.has_noindex === true) niSet.add(cp.id);
              }
            }
          }
          setNodes(data.map((n: any) => ({ ...n, _is_noindex: n.crawl_page_id ? niSet.has(n.crawl_page_id) : false })));
        }
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
        <title>Cocon Sémantique 3D — Architecture SEO | Crawlers.fr</title>
        <meta name="description" content="Cocon sémantique 3D — visualisez et optimisez l'architecture sémantique de votre site. TF-IDF, clusters thématiques, recommandations de maillage automatiques." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/cocoon" />
        <meta property="og:title" content="Cocon Sémantique 3D — Architecture SEO | Crawlers.fr" />
        <meta property="og:description" content="Cocon sémantique 3D — visualisez et optimisez l'architecture sémantique de votre site. TF-IDF, clusters thématiques, recommandations de maillage automatiques." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Cocon Sémantique 3D — Architecture SEO | Crawlers.fr" />
        <meta name="twitter:description" content="Cocon sémantique 3D — visualisez et optimisez l'architecture sémantique de votre site. TF-IDF, clusters thématiques, recommandations de maillage automatiques." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
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

      <div className="dark h-screen flex flex-col relative pt-2 sm:pt-4 overflow-hidden bg-[#0f0a1e] transition-all duration-300 ease-in-out">

        {/* Top Bar */}
        {!isFullscreen && (
        <header className="shrink-0 overflow-visible backdrop-blur-xl px-2 sm:px-4 md:px-6 py-2 bg-[#0f0a1e]/80 relative z-30">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-y-2 gap-x-2">
            {/* Back + Title */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/app/console')}
                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors shrink-0"
                aria-label="Retour Console"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
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
              <CocoonSiteSelector
                userId={user?.id || ""}
                trackedSites={trackedSites}
                selectedSiteId={selectedSiteId}
                onSelect={setSelectedSiteId}
                onSiteCreated={(site) => setTrackedSites(prev => [site, ...prev])}
                placeholder={t.selectSite}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative z-40">
              {/* Settings panel */}
              {nodes.length > 0 && (
                <div ref={settingsPanelRef} className="relative z-50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-haspopup="dialog"
                    aria-expanded={isSettingsOpen}
                    onClick={() => setIsSettingsOpen((open) => !open)}
                    className={`h-7 sm:h-8 text-[10px] sm:text-xs border-[hsl(263,70%,20%)] px-2 sm:px-3 ${
                      isSettingsOpen ? 'bg-white/10 text-white' : 'bg-transparent text-white/60 hover:text-white'
                    }`}
                  >
                    <Settings2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  </Button>

                  {isSettingsOpen && (
                    <div
                      role="dialog"
                      aria-label={language === 'es' ? 'Ajustes del gráfico' : language === 'en' ? 'Graph settings' : 'Réglages du graphe'}
                      className="absolute right-0 top-full mt-2 w-72 rounded-md border border-white/10 bg-[#0f0a1e]/95 p-4 shadow-md backdrop-blur-xl z-[60] space-y-4"
                    >
                      {/* Contrast */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">{language === 'es' ? 'Contraste' : language === 'en' ? 'Contrast' : 'Contraste'}</span>
                          <span className="text-[9px] text-white/30 font-mono">{graphContrast}%</span>
                        </div>
                        <Slider min={50} max={200} step={5} value={[graphContrast]} onValueChange={([v]) => setGraphContrast(v)} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/60 [&_[data-orientation=horizontal]]:h-[2px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/25" />
                      </div>
                      {/* Halo (color intensity) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">Halo</span>
                          <span className="text-[9px] text-white/30 font-mono">{colorIntensity}</span>
                        </div>
                        <Slider min={0} max={10} step={1} value={[colorIntensity]} onValueChange={([v]) => setColorIntensity(v)} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/60 [&_[data-orientation=horizontal]]:h-[2px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/25" />
                      </div>
                      {/* Background warmth */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">{language === 'en' ? 'Warmth' : language === 'es' ? 'Calidez' : 'Chaleur'}</span>
                          <span className="text-[9px] text-white/30 font-mono">{bgWarmth}</span>
                        </div>
                        <Slider min={-10} max={10} step={1} value={[bgWarmth]} onValueChange={([v]) => setBgWarmth(v)} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/60 [&_[data-orientation=horizontal]]:h-[2px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/25" />
                      </div>
                      {/* Link & particle thickness */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">{language === 'en' ? 'Thickness' : language === 'es' ? 'Grosor' : 'Épaisseur'}</span>
                          <span className="text-[9px] text-white/30 font-mono">{linkThickness.toFixed(1)}×</span>
                        </div>
                        <Slider min={0.5} max={8} step={0.1} value={[linkThickness]} onValueChange={([v]) => setLinkThickness(v)} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/60 [&_[data-orientation=horizontal]]:h-[2px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/25" />
                      </div>
                      {/* Background color */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">{language === 'en' ? 'Background' : language === 'es' ? 'Fondo' : 'Fond'}</span>
                          <span className="text-[9px] text-white/30 font-mono">{bgColor === 0 ? '●' : bgColor < 0 ? '◼' : '◻'}</span>
                        </div>
                        <Slider min={-10} max={10} step={1} value={[bgColor]} onValueChange={([v]) => setBgColor(v)} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/60 [&_[data-orientation=horizontal]]:h-[2px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/25" />
                        <div className="flex justify-between text-[8px] text-white/25">
                          <span>{language === 'en' ? 'Black' : language === 'es' ? 'Negro' : 'Noir'}</span>
                          <span>{language === 'en' ? 'Night blue' : language === 'es' ? 'Azul noche' : 'Bleu nuit'}</span>
                          <span>{language === 'en' ? 'White' : language === 'es' ? 'Blanco' : 'Blanc'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                <span className="hidden sm:inline">{(isComputing || isAutoRefreshing) ? t.analyzingData : (nodes.length === 0 ? t.generateGraph : t.refreshData)}</span>
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
                  params.set('viewMode', viewMode);
                  params.set('bgColor', String(bgColor));
                  params.set('bgWarmth', String(bgWarmth));
                  params.set('contrast', String(graphContrast));
                  params.set('halo', String(colorIntensity));
                  params.set('thickness', String(linkThickness));
                  window.open(`/app/cocoon?${params.toString()}`, '_blank');
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
        <main className={`flex-1 relative px-4 sm:px-6 md:px-10 lg:px-14 pt-3 sm:pt-4 lg:pt-6 min-h-0 flex flex-col ${isFullscreen ? 'pb-8 sm:pb-10 lg:pb-14' : 'pb-0'}`}>
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden border relative border-[hsl(263,70%,20%)]" style={{ backgroundColor: computedBgColor, filter: `contrast(${graphContrast}%) brightness(${50 + graphContrast / 2}%)` }}>
            {/* 2D / 3D toggle */}
            {nodes.length > 0 && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5 px-1.5 py-1 rounded-md backdrop-blur-md border bg-black/50 border-white/10">
                <button
                  onClick={() => setViewMode('force')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${viewMode === 'force' ? 'text-white/70 font-semibold bg-white/5' : 'text-white/25 hover:text-white/50'}`}
                >
                  Force
                </button>
                <span className="text-white/15">·</span>
                <button
                  onClick={() => setViewMode('radial')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${viewMode === 'radial' ? 'text-white/70 font-semibold bg-white/5' : 'text-white/25 hover:text-white/50'}`}
                >
                  Radial
                </button>
                <span className="text-white/15">·</span>
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${viewMode === '3d' ? 'text-white/70 font-semibold bg-white/5' : 'text-white/25 hover:text-white/50'}`}
                >
                  3D
                </button>
              </div>
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
            ) : viewMode === '3d' ? (
              <CocoonForceGraph3D
                key={`3d-${selectedSiteId}`}
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
                particlesEnabled={particlesEnabled && cocoonFilters.showParticles}
                nodeColors={cocoonTheme.nodeColors}
                particleColors={cocoonTheme.particleColors}
                haloColors={cocoonTheme.haloColors}
                showClusters={cocoonFilters.showAllClusters}
                visibleJuiceTypes={cocoonFilters.visibleJuiceTypes}
                visibleLinkDirections={cocoonFilters.visibleLinkDirections}
                isDayMode={false}
                colorIntensity={colorIntensity}
                bgWarmth={bgWarmth}
                linkThickness={linkThickness}
                bgColorSlider={bgColor}
              />
            ) : viewMode === 'radial' ? (
              <CocoonRadialGraph
                key={`radial-${selectedSiteId}`}
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
                showClusters={cocoonFilters.showAllClusters}
                visibleJuiceTypes={cocoonFilters.visibleJuiceTypes}
                visibleLinkDirections={cocoonFilters.visibleLinkDirections}
                colorIntensity={colorIntensity}
                nodeColors={cocoonTheme.nodeColors}
                bgColorSlider={bgColor}
                particlesEnabled={particlesEnabled && cocoonFilters.showParticles}
                showFanBeams={cocoonFilters.showFanBeams}
                onFanBeamLegend={setFanBeamLegend}
              />
            ) : (
              <CocoonForceGraph
                key={`force-${selectedSiteId}`}
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
                particlesEnabled={particlesEnabled && cocoonFilters.showParticles}
                isDayMode={false}
                nodeColors={cocoonTheme.nodeColors}
                particleColors={cocoonTheme.particleColors}
                visibleJuiceTypes={cocoonFilters.visibleJuiceTypes}
                visibleLinkDirections={cocoonFilters.visibleLinkDirections}
                showClusters={cocoonFilters.showAllClusters}
                colorIntensity={colorIntensity}
              />
        )}

        {hasAccess && selectedSiteId && (
          <CocoonBulkAutoLinking
            open={showBulkAutoLink}
            onOpenChange={setShowBulkAutoLink}
            trackedSiteId={selectedSiteId}
            hasCmsConnection={hasCmsConnection}
          />
        )}


            {/* Controls moved to header settings popover */}

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
                trackedSiteId={selectedSiteId}
              />
            )}

          </div>

          {/* Links legend — centered below preview */}
          {nodes.length > 0 && (
            <div className="shrink-0 flex flex-col items-center px-3 sm:px-6 py-2 sm:py-3 opacity-0 animate-fade-in gap-1.5"
              style={{ animationDelay: '1.2s', animationFillMode: 'forwards' }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs text-white/70 font-semibold">{language === 'en' ? 'Links:' : 'Liens :'}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded" />
                  <span className="text-[10px] text-white/40">↓ {language === 'en' ? 'downstream' : language === 'es' ? 'descendente' : 'descendant'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#60a5fa] to-[#22d3ee] rounded" />
                  <span className="text-[10px] text-white/40">↑ {language === 'en' ? 'upstream' : language === 'es' ? 'ascendente' : 'ascendant'}</span>
                </div>
              </div>

              {/* Fan beam family legend */}
              {cocoonFilters.showFanBeams && fanBeamLegend.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="text-[10px] sm:text-xs text-white/70 font-semibold">{language === 'en' ? 'Families:' : 'Familles :'}</span>
                  {fanBeamLegend.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.6 }} />
                      <span className="text-[10px] text-white/50">{item.name} ({item.nodeCount})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Bottom bar: Console left, AI Chat center-left, nav buttons right */}
        {!isFullscreen && (
        <div className="shrink-0 px-3 sm:px-4 md:px-6 py-9 flex items-end gap-2 sm:gap-4 flex-wrap">
          {/* AI Chat — bottom left, shifted left */}
          {hasAccess && (
            <div className="relative ml-2 sm:ml-4">
              <CocoonAIChat
                nodes={nodes}
                selectedNodeId={selectedNode?.id}
                onRequestNodePick={(cb) => setNodePickerCallback(() => cb)}
                onCancelPick={() => setNodePickerCallback(null)}
                trackedSiteId={selectedSiteId}
                domain={trackedSites.find(s => s.id === selectedSiteId)?.domain || ''}
                onGenerateGraph={handleCompute}
              />
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Report button — bottom right */}
          {hasAccess && nodes.length > 0 && selectedSiteId && (
            <button
              onClick={async () => {
                const selectedSite = trackedSites.find(s => s.id === selectedSiteId);
                if (!selectedSite || !user) return;
                // Fetch branding
                const { data: prof } = await supabase.from('profiles').select('agency_logo_url, agency_primary_color, agency_brand_name, agency_contact_first_name, agency_contact_last_name, agency_contact_email, agency_contact_phone, agency_report_header_text, agency_report_footer_text, agency_report_font').eq('user_id', user.id).maybeSingle();
                const branding = prof ? {
                  logoUrl: prof.agency_logo_url,
                  primaryColor: prof.agency_primary_color,
                  brandName: prof.agency_brand_name,
                  contactFirstName: prof.agency_contact_first_name,
                  contactLastName: prof.agency_contact_last_name,
                  contactEmail: prof.agency_contact_email,
                  contactPhone: prof.agency_contact_phone,
                  reportHeaderText: prof.agency_report_header_text,
                  reportFooterText: prof.agency_report_footer_text,
                  reportFont: prof.agency_report_font,
                } : undefined;
                await generateCocoonReport({
                  nodes,
                  domain: selectedSite.domain,
                  siteName: selectedSite.site_name || selectedSite.domain,
                  trackedSiteId: selectedSiteId,
                  userId: user.id,
                  language,
                  branding,
                });
                // Auto-save to saved_reports
                await saveReport({
                  reportType: 'cocoon' as any,
                  title: `Rapport Cocoon — ${selectedSite.domain}`,
                  url: `https://${selectedSite.domain}`,
                  reportData: {
                    domain: selectedSite.domain,
                    siteName: selectedSite.site_name || selectedSite.domain,
                    nodesCount: nodes.length,
                    generatedAt: new Date().toISOString(),
                  },
                });
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20 backdrop-blur-md transition-all shrink-0"
            >
              <FileBarChart className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">{language === 'en' ? 'Report' : language === 'es' ? 'Informe' : 'Rapport'}</span>
            </button>
          )}

          {/* Bulk Auto-Linking button */}
          {hasAccess && selectedSiteId && (
            <button
              onClick={() => setShowBulkAutoLink(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 backdrop-blur-md transition-all shrink-0"
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">{language === 'en' ? 'Auto-Link All' : language === 'es' ? 'Auto-Enlace' : 'Auto-Maillage'}</span>
            </button>
          )}

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
                        navigate(`/app/site-crawl${domain ? `?url=${encodeURIComponent(domain)}&from=cocoon` : '?from=cocoon'}`);
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

      {/* Onboarding stepper */}
      <AnimatePresence>
        {showOnboarding && hasAccess && (
          <CocoonOnboardingStepper onComplete={() => setShowOnboarding(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function Cocoon() {
  return (
    <DesktopOnlyGate featureName="Cocoon (graphe sémantique)">
      <CocoonContent />
    </DesktopOnlyGate>
  );
}
