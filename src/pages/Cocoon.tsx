import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CocoonForceGraph } from "@/components/Cocoon/CocoonForceGraph";
import { CocoonNodePanel } from "@/components/Cocoon/CocoonNodePanel";
import { Loader2, Eye, EyeOff, RefreshCw, Lock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export default function Cocoon() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("calculate-cocoon-logic", {
        body: { tracked_site_id: selectedSiteId },
      });

      if (resp.error) {
        toast({
          title: "Erreur",
          description: resp.error.message || "Erreur lors du calcul du cocon",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cocon généré",
          description: `${resp.data?.stats?.nodes_count || 0} nœuds · ${resp.data?.stats?.clusters_count || 0} clusters`,
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
        title: "Erreur",
        description: "Impossible de calculer le cocon sémantique",
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
          <title>Cocoon — Architecture Sémantique | Crawlers.fr</title>
          <meta name="description" content="Visualisez l'architecture sémantique de votre site comme un organisme vivant. Analyse GEO, ROI prédictif et maillage intelligent." />
        </Helmet>
        <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#4c1d95]/30 flex items-center justify-center mx-auto border border-[#4c1d95]/20">
              <Lock className="w-8 h-8 text-[#fbbf24]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Accès Pro Agency</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Le module Cocoon est réservé aux abonnés Pro Agency.
              Visualisez l'architecture sémantique de votre site, optimisez votre maillage
              et prédisez le ROI de chaque page.
            </p>
            <div className="flex gap-3 justify-center">
              {!user && (
                <Button
                  onClick={() => navigate("/auth")}
                  className="bg-[#4c1d95] hover:bg-[#5b21b6] text-white"
                >
                  Se connecter
                </Button>
              )}
              <Button
                onClick={() => navigate("/pro-agency")}
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold"
              >
                Découvrir Pro Agency
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const selectedSite = trackedSites.find((s) => s.id === selectedSiteId);

  return (
    <>
      <Helmet>
        <title>Cocoon — Architecture Sémantique | Crawlers.fr</title>
        <meta name="description" content="Visualisez l'architecture sémantique de votre site comme un organisme vivant. Analyse GEO, ROI prédictif et maillage intelligent." />
        <link rel="canonical" href="https://crawlers.fr/cocoon" />
      </Helmet>

      <div className="min-h-screen bg-[#0f0a1e] flex flex-col">
        {/* Top Bar */}
        <header className="shrink-0 border-b border-[hsl(263,70%,20%)] bg-[#0f0a1e]/80 backdrop-blur-xl px-4 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fbbf24] animate-pulse" />
              <h1 className="text-sm font-bold text-white font-display tracking-tight">
                Cocoon <span className="text-[#fbbf24]">·</span> Organisme Vivant
              </h1>
            </div>

            {/* Site selector */}
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-[240px] bg-white/5 border-[hsl(263,70%,20%)] text-white text-xs h-8">
                <SelectValue placeholder="Sélectionner un site" />
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
                X-Ray
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
                {isComputing ? "Calcul..." : "Générer le Cocon"}
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
                <p className="text-white/40 text-sm">Chargement du graphe sémantique…</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-[#4c1d95]/20 flex items-center justify-center mx-auto border border-[#4c1d95]/15">
                  <RefreshCw className="w-8 h-8 text-[#a78bfa]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Aucun cocon généré</h2>
                <p className="text-white/40 text-sm">
                  Sélectionnez un site tracké puis cliquez sur "Générer le Cocon" pour construire
                  l'architecture sémantique à partir de vos données de crawl.
                </p>
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
