import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CocoonForceGraph } from "@/components/Cocoon/CocoonForceGraph";
import { CocoonNodePanel } from "@/components/Cocoon/CocoonNodePanel";
import { Loader2, Eye, EyeOff, RefreshCw, Lock, ChevronDown, Crown, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    generate: "Générer le Cocon",
    loading: "Chargement du graphe sémantique…",
    noGraph: "Aucun cocon généré",
    noGraphDesc: "Sélectionnez un site tracké puis cliquez sur \"Générer le Cocon\" pour construire l'architecture sémantique à partir de vos données de crawl.",
    errorTitle: "Erreur",
    errorCompute: "Erreur lors du calcul du cocon",
    errorGeneric: "Impossible de calculer le cocon sémantique",
    successTitle: "Cocon généré",
    successDesc: (nodes: number, clusters: number) => `${nodes} nœuds · ${clusters} clusters`,
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
    generate: "Generate Cocoon",
    loading: "Loading semantic graph…",
    noGraph: "No cocoon generated",
    noGraphDesc: "Select a tracked site then click \"Generate Cocoon\" to build the semantic architecture from your crawl data.",
    errorTitle: "Error",
    errorCompute: "Error computing the cocoon",
    errorGeneric: "Unable to compute the semantic cocoon",
    successTitle: "Cocoon generated",
    successDesc: (nodes: number, clusters: number) => `${nodes} nodes · ${clusters} clusters`,
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
    generate: "Generar Cocoon",
    loading: "Cargando grafo semántico…",
    noGraph: "Ningún cocoon generado",
    noGraphDesc: "Seleccione un sitio rastreado y haga clic en \"Generar Cocoon\" para construir la arquitectura semántica a partir de sus datos de rastreo.",
    errorTitle: "Error",
    errorCompute: "Error al calcular el cocoon",
    errorGeneric: "No se pudo calcular el cocoon semántico",
    successTitle: "Cocoon generado",
    successDesc: (nodes: number, clusters: number) => `${nodes} nodos · ${clusters} clusters`,
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
  const [isXRayMode, setIsXRayMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

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
      if (data?.[0]) setSelectedSiteId(data[0].id);
    };
    loadSites();
  }, [user, hasAccess]);

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
    if (!selectedSiteId) return;
    setIsComputing(true);

    try {
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
        toast({
          title: t.successTitle,
          description: t.successDesc(resp.data?.stats?.nodes_count || 0, resp.data?.stats?.clusters_count || 0),
        });
        // Reload nodes
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

  // Access gate
  if (hasAccess === false) {
    return (
      <>
        <Helmet>
          <title>{t.title}</title>
          <meta name="description" content={t.metaDesc} />
        </Helmet>
        <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#4c1d95]/30 flex items-center justify-center mx-auto border border-[#4c1d95]/20">
              <Lock className="w-8 h-8 text-[#fbbf24]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-display">{t.accessTitle}</h1>
            <p className="text-white/50 text-sm leading-relaxed">{t.accessDesc}</p>
            <div className="flex gap-3 justify-center">
              {!user && (
                <Button
                  onClick={() => navigate("/auth")}
                  className="bg-[#4c1d95] hover:bg-[#5b21b6] text-white"
                >
                  {t.login}
                </Button>
              )}
              <Button
                onClick={() => navigate("/pro-agency")}
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold"
              >
                {t.discoverPro}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
      </Helmet>

      <div className="min-h-screen bg-[#0f0a1e] flex flex-col">
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
              {/* X-Ray toggle */}
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

              {/* Compute button */}
              <Button
                size="sm"
                onClick={handleCompute}
                disabled={isComputing || !selectedSiteId}
                className="h-8 text-xs bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold disabled:opacity-50"
              >
                {isComputing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isComputing ? t.computing : t.generate}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Graph */}
        <main className="flex-1 relative">
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
              onNodeSelect={setSelectedNode}
              isXRayMode={isXRayMode}
            />
          )}

          {/* Side Panel */}
          {selectedNode && (
            <CocoonNodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </main>
      </div>
    </>
  );
}
