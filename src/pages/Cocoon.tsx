import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CocoonForceGraph } from "@/components/Cocoon/CocoonForceGraph";
import { CocoonNodePanel } from "@/components/Cocoon/CocoonNodePanel";
import { CocoonHelpModal } from "@/components/Cocoon/CocoonHelpModal";
import { CocoonAIChat } from "@/components/Cocoon/CocoonAIChat";
import { CocoonAccessGate } from "@/components/Cocoon/CocoonAccessGate";
import { Loader2, Eye, EyeOff, RefreshCw, Lock, ChevronDown, Crown, Star, CheckCircle2, AlertTriangle, Search, FileText, ArrowLeft, LayoutDashboard, ExternalLink, Database } from "lucide-react";
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

export default function Cocoon() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  useCanonicalHreflang('/cocoon');
  const t = i18n[language] || i18n.fr;

  const [trackedSites, setTrackedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodePickerCallback, setNodePickerCallback] = useState<((node: any) => void) | null>(null);
  const [isXRayMode, setIsXRayMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [prereqStatus, setPrereqStatus] = useState<{ hasCrawl: boolean; hasAudit: boolean }>({ hasCrawl: true, hasAudit: true });
  const [truncationInfo, setTruncationInfo] = useState<{ truncated: boolean; total: number; used: number } | null>(null);
  const [autoLaunchDomain, setAutoLaunchDomain] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoLaunchTriggered = useRef(false);
  const externalClickTimestamp = useRef<number | null>(null);

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

  // Read autolaunch param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('autolaunch');
    if (domain) {
      setAutoLaunchDomain(domain);
      // Clean URL
      navigate('/cocoon', { replace: true });
    }
  }, [navigate]);

  // Load tracked sites
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

      <div className="min-h-screen bg-[#0f0a1e] flex flex-col relative">

        {/* Top Bar */}
        <header className="shrink-0 border-b border-[hsl(263,70%,20%)] bg-[#0f0a1e]/80 backdrop-blur-xl px-4 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse" />
              <h1 className="text-sm font-bold text-white font-display tracking-tight">
                Cocoon <span className="text-[#fbbf24]">·</span> {t.organism}
              </h1>
            </div>

            {/* Site selector */}
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-[240px] bg-white/5 border-[hsl(263,70%,20%)] text-white text-xs h-8">
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

            <div className="flex items-center gap-2 ml-auto">
              <CocoonHelpModal />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompute}
                disabled={isComputing || !selectedSiteId}
                className="h-8 text-xs border-[hsl(263,70%,20%)] bg-transparent text-white/60 hover:text-white gap-1.5"
              >
                {(isComputing || isAutoRefreshing) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {(isComputing || isAutoRefreshing) ? 'Analyses data...' : 'Actualiser data'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsXRayMode(!isXRayMode)}
                className={`h-8 text-xs border-[hsl(263,70%,20%)] ${
                  isXRayMode
                    ? "bg-[#4c1d95]/50 text-[#fbbf24]"
                    : "bg-transparent text-white/60 hover:text-white"
                }`}
              >
                {isXRayMode ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                {t.xray}
              </Button>

            </div>
          </div>
        </header>

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
        <main className={`flex-1 relative px-4 md:px-6 pb-6`}>
          <div className="h-full rounded-xl overflow-hidden border border-[hsl(263,70%,20%)] relative">
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
            ) : (
              <CocoonForceGraph
                nodes={nodes}
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
              />
            )}

            {/* Side Panel */}
            {selectedNode && (
              <CocoonNodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
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
                className="flex items-center gap-4 mt-3 px-1 flex-wrap opacity-0 animate-fade-in"
                style={{ animationDelay: '1.2s', animationFillMode: 'forwards' }}
              >
                {legendItems.map(([type, { color, label }]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-white/50 text-xs">{label[language] || label.fr}</span>
                  </div>
                ))}
                <span className="text-white/20 mx-1">|</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded" />
                  <span className="text-white/40 text-[10px]">↓ {language === 'en' ? 'downstream' : language === 'es' ? 'descendente' : 'descendant'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-[#60a5fa] to-[#22d3ee] rounded" />
                  <span className="text-white/40 text-[10px]">↑ {language === 'en' ? 'upstream' : language === 'es' ? 'ascendente' : 'ascendant'}</span>
                </div>
                <span className="text-white/30 text-xs ml-auto">⌂ = Home · {language === 'en' ? 'Size ∝ depth' : language === 'es' ? 'Tamaño ∝ profundidad' : 'Taille ∝ profondeur'}</span>
              </div>
            );
          })()}
        </main>

        {/* AI Chat for interpreting results */}
        {hasAccess && nodes.length > 0 && (
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="w-full max-w-[400px]">
              <CocoonAIChat
                nodes={nodes}
                selectedNodeId={selectedNode?.id}
                onRequestNodePick={(cb) => setNodePickerCallback(() => cb)}
                onCancelPick={() => setNodePickerCallback(null)}
              />
            </div>
          </div>
        )}

        {/* Bottom-right navigation */}
        <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2 items-end">
          <a
            href="/audit-expert"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { externalClickTimestamp.current = Date.now(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors text-xs backdrop-blur-md"
          >
            <FileText className="w-3 h-3" />
            Audit Expert
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href="/crawl-multipages"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { externalClickTimestamp.current = Date.now(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors text-xs backdrop-blur-md"
          >
            <Search className="w-3 h-3" />
            Crawl Multi-pages
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={() => navigate('/console')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors text-xs font-medium backdrop-blur-md"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Console
          </button>
        </div>

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
