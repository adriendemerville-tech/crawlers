import { useState, useEffect, useRef } from "react";
import { X, TrendingUp, Target, Globe, Zap, Link2, ExternalLink, Layers, FileText, Clock, Search, RefreshCw, Wand2, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SemanticNode {
  id: string;
  url: string;
  title: string;
  h1: string;
  intent: string;
  cluster_id: string | null;
  keywords: string[];
  iab_score: number;
  geo_score: number;
  roi_predictive: number;
  traffic_estimate: number;
  citability_score: number;
  eeat_score: number;
  keyword_difficulty: number;
  cpc_value: number;
  search_volume: number;
  content_gap_score: number;
  cannibalization_risk: number;
  internal_links_in: number;
  internal_links_out: number;
  freshness_score: number;
  similarity_edges: { target_url: string; score: number; type: string }[];
  crawl_depth?: number;
  page_type?: string;
  page_updated_at?: string;
  word_count?: number;
}

interface CocoonNodePanelProps {
  node: SemanticNode;
  onClose: () => void;
  onRefresh?: () => void;
  onAuditLaunch?: () => void;
  isWaitingAudit?: boolean;
  trackedSiteId?: string;
}

interface LinkSuggestion {
  target_url: string;
  target_title: string;
  anchor_text: string;
  context_sentence: string;
  confidence: number;
  pre_scan_match: boolean;
}

const i18n = {
  fr: {
    intents: { transactional: "Transactionnel", commercial: "Commercial", informational: "Informationnel", navigational: "Navigationnel" },
    depths: { 0: "Mère", 1: "Fille", 2: "Fille²", 3: "Fille³" },
    pageTypes: {
      homepage: "Accueil", blog: "Blog", produit: "Produit", "catégorie": "Catégorie",
      faq: "FAQ", contact: "Contact", tarifs: "Tarifs", "légal": "Légal",
      "à propos": "À propos", guide: "Guide", page: "Page", unknown: "Page",
    },
    roiLabel: "ROI Prédictif / an",
    trafficLabel: "Trafic estimé / mois",
    scoresTitle: "Scores STD",
    iab: "Iab (Anti-Wiki)",
    geo: "GEO Score",
    citability: "Citabilité LLM",
    eeat: "E-E-A-T",
    freshness: "Fraîcheur",
    contentGap: "Content Gap",
    cannibalization: "Risque Cannibalisation",
    seoMetrics: "Métriques SEO",
    volume: "Volume",
    kd: "KD",
    cpc: "CPC",
    words: "Mots",
    linkingTitle: "Maillage",
    linksIn: "Liens entrants",
    linksOut: "Liens sortants",
    keywordsTitle: "Mots-clés",
    similarityTitle: "Proximité sémantique",
    lastUpdated: "Dernière MàJ",
    depth: "depth",
    autoLink: "Auto-Maillage IA",
    autoLinkRunning: "Analyse en cours…",
    excludeSource: "Pas de liens sortants",
    excludeTarget: "Pas de liens entrants",
    excludeAll: "Exclure du maillage",
    linkingSuggestions: "Suggestions de liens",
    preScan: "Pré-scan",
    aiGenerated: "IA",
    deploy: "Déployer",
    savedCalls: "appels API économisés",
  },
  en: {
    intents: { transactional: "Transactional", commercial: "Commercial", informational: "Informational", navigational: "Navigational" },
    depths: { 0: "Parent", 1: "Child", 2: "Child²", 3: "Child³" },
    pageTypes: {
      homepage: "Home", blog: "Blog", produit: "Product", "catégorie": "Category",
      faq: "FAQ", contact: "Contact", tarifs: "Pricing", "légal": "Legal",
      "à propos": "About", guide: "Guide", page: "Page", unknown: "Page",
    },
    roiLabel: "Predictive ROI / year",
    trafficLabel: "Estimated traffic / month",
    scoresTitle: "STD Scores",
    iab: "Iab (Anti-Wiki)",
    geo: "GEO Score",
    citability: "LLM Citability",
    eeat: "E-E-A-T",
    freshness: "Freshness",
    contentGap: "Content Gap",
    cannibalization: "Cannibalization Risk",
    seoMetrics: "SEO Metrics",
    volume: "Volume",
    kd: "KD",
    cpc: "CPC",
    words: "Words",
    linkingTitle: "Internal Linking",
    linksIn: "Inbound links",
    linksOut: "Outbound links",
    keywordsTitle: "Keywords",
    similarityTitle: "Semantic proximity",
    lastUpdated: "Last updated",
    depth: "depth",
    autoLink: "Auto-Link AI",
    autoLinkRunning: "Analyzing…",
    excludeSource: "No outbound links",
    excludeTarget: "No inbound links",
    excludeAll: "Exclude from linking",
    linkingSuggestions: "Link suggestions",
    preScan: "Pre-scan",
    aiGenerated: "AI",
    deploy: "Deploy",
    savedCalls: "API calls saved",
  },
  es: {
    intents: { transactional: "Transaccional", commercial: "Comercial", informational: "Informacional", navigational: "Navegacional" },
    depths: { 0: "Madre", 1: "Hija", 2: "Hija²", 3: "Hija³" },
    pageTypes: {
      homepage: "Inicio", blog: "Blog", produit: "Producto", "catégorie": "Categoría",
      faq: "FAQ", contact: "Contacto", tarifs: "Precios", "légal": "Legal",
      "à propos": "Acerca de", guide: "Guía", page: "Página", unknown: "Página",
    },
    roiLabel: "ROI Predictivo / año",
    trafficLabel: "Tráfico estimado / mes",
    scoresTitle: "Scores STD",
    iab: "Iab (Anti-Wiki)",
    geo: "GEO Score",
    citability: "Citabilidad LLM",
    eeat: "E-E-A-T",
    freshness: "Frescura",
    contentGap: "Content Gap",
    cannibalization: "Riesgo Canibalización",
    seoMetrics: "Métricas SEO",
    volume: "Volumen",
    kd: "KD",
    cpc: "CPC",
    words: "Palabras",
    linkingTitle: "Enlazado interno",
    linksIn: "Enlaces entrantes",
    linksOut: "Enlaces salientes",
    keywordsTitle: "Palabras clave",
    similarityTitle: "Proximidad semántica",
    lastUpdated: "Última actualización",
    depth: "profundidad",
    autoLink: "Auto-Enlace IA",
    autoLinkRunning: "Analizando…",
    excludeSource: "Sin enlaces salientes",
    excludeTarget: "Sin enlaces entrantes",
    excludeAll: "Excluir del enlazado",
    linkingSuggestions: "Sugerencias de enlaces",
    preScan: "Pre-scan",
    aiGenerated: "IA",
    deploy: "Desplegar",
    savedCalls: "llamadas API ahorradas",
  },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  homepage: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  blog: "text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/20",
  produit: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "catégorie": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  faq: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  contact: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  tarifs: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  "légal": "text-gray-400 bg-gray-400/10 border-gray-400/20",
  "à propos": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  guide: "text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/20",
  page: "text-white/50 bg-white/5 border-white/10",
  unknown: "text-white/50 bg-white/5 border-white/10",
};

function ScoreBadge({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct >= 70 ? "from-emerald-500 to-emerald-400" :
    pct >= 40 ? "from-amber-500 to-yellow-400" :
    "from-rose-500 to-red-400";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white font-mono">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(dateStr: string | undefined, lang: string): string {
  if (!dateStr) return "—";
  try {
    const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR';
    return new Date(dateStr).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function ExclusionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px] cursor-pointer group">
      <div 
        className={`w-7 h-4 rounded-full transition-colors relative ${checked ? 'bg-rose-500/60' : 'bg-white/10'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </div>
      <span className={`${checked ? 'text-rose-400' : 'text-white/50'} group-hover:text-white/70 transition-colors`}>{label}</span>
    </label>
  );
}

export function CocoonNodePanel({ node, onClose, onRefresh, onAuditLaunch, isWaitingAudit, trackedSiteId }: CocoonNodePanelProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = i18n[language] || i18n.fr;
  const [fadeKey, setFadeKey] = useState(0);
  const prevNodeRef = useRef(node);

  // Auto-linking state
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [linkStats, setLinkStats] = useState<{ pre_scan_matches: number; ai_generated: number; api_calls_saved: number } | null>(null);

  // Exclusion state
  const [excludeSource, setExcludeSource] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState(false);
  const [excludeAll, setExcludeAll] = useState(false);

  // Load exclusions on mount/node change
  useEffect(() => {
    if (!trackedSiteId) return;
    supabase
      .from('cocoon_linking_exclusions' as any)
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .eq('page_url', node.url)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setExcludeSource(data.exclude_as_source || false);
          setExcludeTarget(data.exclude_as_target || false);
          setExcludeAll(data.exclude_all || false);
        } else {
          setExcludeSource(false);
          setExcludeTarget(false);
          setExcludeAll(false);
        }
      });
  }, [trackedSiteId, node.url]);

  // Save exclusion changes
  const updateExclusion = async (field: string, value: boolean) => {
    if (!trackedSiteId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = {
      tracked_site_id: trackedSiteId,
      user_id: user.id,
      page_url: node.url,
      [field]: value,
    };

    if (field === 'exclude_all') {
      setExcludeAll(value);
      if (value) { setExcludeSource(true); setExcludeTarget(true); updates.exclude_as_source = true; updates.exclude_as_target = true; }
    } else if (field === 'exclude_as_source') {
      setExcludeSource(value);
    } else if (field === 'exclude_as_target') {
      setExcludeTarget(value);
    }

    await supabase
      .from('cocoon_linking_exclusions' as any)
      .upsert(updates, { onConflict: 'tracked_site_id,page_url' } as any);
  };

  // Auto-linking
  const handleAutoLink = async () => {
    if (!trackedSiteId || isAutoLinking) return;
    setIsAutoLinking(true);
    setLinkSuggestions([]);
    setLinkStats(null);

    try {
      const { data, error } = await supabase.functions.invoke('cocoon-auto-linking', {
        body: {
          tracked_site_id: trackedSiteId,
          source_url: node.url,
          max_links: 3,
          dry_run: false,
        },
      });

      if (error) throw error;
      setLinkSuggestions(data.suggestions || []);
      setLinkStats(data.stats || null);

      if (data.suggestions?.length > 0) {
        toast.success(`${data.suggestions.length} lien(s) suggéré(s)`, {
          description: data.stats?.api_calls_saved > 0 
            ? `${data.stats.api_calls_saved} ${t.savedCalls}` 
            : undefined,
        });
      } else {
        toast.info(data.message || 'Aucune suggestion trouvée');
      }
    } catch (err: any) {
      console.error('Auto-linking error:', err);
      toast.error('Erreur lors de l\'auto-maillage');
    } finally {
      setIsAutoLinking(false);
    }
  };

  // Trigger fade-in when node data changes
  useEffect(() => {
    if (prevNodeRef.current !== node && prevNodeRef.current.url === node.url) {
      setFadeKey(k => k + 1);
    }
    prevNodeRef.current = node;
  }, [node]);

  // Reset suggestions on node change
  useEffect(() => {
    setLinkSuggestions([]);
    setLinkStats(null);
  }, [node.url]);

  const depthLabel = (t.depths as Record<number, string>)[node.crawl_depth ?? 0] ||
    `${t.depths[1]}${"⁴⁵⁶⁷⁸⁹"[(node.crawl_depth ?? 4) - 4] || `^${node.crawl_depth}`}`;
  const pageTypeLabel = (t.pageTypes as Record<string, string>)[node.page_type || "unknown"] || t.pageTypes.unknown;
  const pageTypeColor = PAGE_TYPE_COLORS[node.page_type || "unknown"] || PAGE_TYPE_COLORS.unknown;
  const intentLabel = (t.intents as Record<string, string>)[node.intent] || node.intent;

  return (
    <div key={fadeKey} className="absolute top-4 right-4 bottom-4 w-[360px] rounded-xl bg-[#0f0a1e]/95 backdrop-blur-xl border border-[hsl(263,70%,20%)] overflow-y-auto z-20 shadow-2xl shadow-black/40 animate-fade-in" style={{ animationDuration: '0.3s' }}>
      {/* Header */}
      <div className="sticky top-0 bg-[#0f0a1e]/90 backdrop-blur p-4 border-b border-[hsl(263,70%,20%)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#fbbf24] truncate">{node.title || node.url}</h3>
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white/40 hover:text-[#a78bfa] transition-colors mt-0.5 group"
            >
              <span className="truncate">{node.url}</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                window.open(`/audit-expert?url=${encodeURIComponent(node.url)}`, '_blank');
                onAuditLaunch?.();
              }}
              title={language === 'en' ? 'Expert Audit' : language === 'es' ? 'Auditoría experta' : 'Audit Expert'}
              className="p-1.5 rounded-md border border-[#3b82f6]/30 hover:bg-[#3b82f6]/10 text-white/40 hover:text-[#60a5fa] transition-colors"
            >
              {isWaitingAudit ? (
                <Search className="w-4 h-4 text-[#60a5fa]" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onRefresh}
              title={language === 'en' ? 'Refresh data' : language === 'es' ? 'Actualizar datos' : 'Rafraîchir les données'}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#4c1d95]/50 text-[#a78bfa] border border-[#4c1d95]/30">
            {intentLabel}
          </span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${pageTypeColor}`}>
            <FileText className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
            {pageTypeLabel}
          </span>
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/60 border border-white/10">
            <Layers className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
            {depthLabel}
            <span className="text-white/30 ml-1">({t.depth} {node.crawl_depth ?? 0})</span>
          </span>
          {node.cluster_id && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/50 border border-white/10">
              {node.cluster_id}
            </span>
          )}
        </div>

        {/* Last updated */}
        {node.page_updated_at && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/40">
            <Clock className="w-3 h-3" />
            {t.lastUpdated} : {formatDate(node.page_updated_at, language)}
          </div>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Auto-Maillage IA Button */}
        {trackedSiteId && (
          <div className="space-y-3">
            <button
              onClick={handleAutoLink}
              disabled={isAutoLinking || excludeAll || excludeSource}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isAutoLinking 
                  ? 'bg-[#a78bfa]/20 text-[#a78bfa] cursor-wait' 
                  : excludeAll || excludeSource
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#a78bfa]/20 to-[#fbbf24]/20 text-white hover:from-[#a78bfa]/30 hover:to-[#fbbf24]/30 border border-[#a78bfa]/30 hover:border-[#a78bfa]/50'
                }`}
            >
              {isAutoLinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.autoLinkRunning}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {t.autoLink}
                </>
              )}
            </button>

            {/* Exclusion toggles */}
            <div className="space-y-1.5 pl-1">
              <ExclusionToggle label={t.excludeSource} checked={excludeSource} onChange={(v) => updateExclusion('exclude_as_source', v)} />
              <ExclusionToggle label={t.excludeTarget} checked={excludeTarget} onChange={(v) => updateExclusion('exclude_as_target', v)} />
              <ExclusionToggle label={t.excludeAll} checked={excludeAll} onChange={(v) => updateExclusion('exclude_all', v)} />
            </div>
          </div>
        )}

        {/* Link Suggestions */}
        {linkSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#a78bfa]" /> {t.linkingSuggestions}
              </h4>
              {linkStats && linkStats.api_calls_saved > 0 && (
                <span className="text-[10px] text-emerald-400/70">
                  ⚡ {linkStats.api_calls_saved} {t.savedCalls}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {linkSuggestions.map((s, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${s.pre_scan_match ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#a78bfa]/20 text-[#a78bfa]'}`}>
                      {s.pre_scan_match ? t.preScan : t.aiGenerated}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-white/80">
                    <span className="text-[#fbbf24] font-medium">{s.anchor_text}</span>
                    <span className="text-white/30 mx-1">→</span>
                    <span className="text-white/50 truncate">{s.target_title}</span>
                  </div>
                  <p className="text-[10px] text-white/40 italic line-clamp-2">{s.context_sentence}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scores */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t.scoresTitle}</h4>
          <ScoreBadge value={node.iab_score} label={t.iab} />
          <ScoreBadge value={node.geo_score} label={t.geo} />
          <ScoreBadge value={node.citability_score} label={t.citability} />
          <ScoreBadge value={node.eeat_score} label={t.eeat} />
          <ScoreBadge value={node.freshness_score} label={t.freshness} />
          <ScoreBadge value={node.content_gap_score} label={t.contentGap} />
          <ScoreBadge value={node.cannibalization_risk} label={t.cannibalization} />
        </div>

        {/* SEO Metrics */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t.seoMetrics}</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">{t.volume}</span>
              <span className="text-white font-mono">{node.search_volume}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">{t.kd}</span>
              <span className="text-white font-mono">{Math.round(node.keyword_difficulty)}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">{t.cpc}</span>
              <span className="text-white font-mono">{node.cpc_value.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">{t.words}</span>
              <span className="text-white font-mono">{node.word_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Internal Links */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> {t.linkingTitle}
          </h4>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-white/50">{t.linksIn} : </span>
              <span className="text-[#fbbf24] font-mono">{node.internal_links_in}</span>
            </div>
            <div>
              <span className="text-white/50">{t.linksOut} : </span>
              <span className="text-[#a78bfa] font-mono">{node.internal_links_out}</span>
            </div>
          </div>
        </div>

        {/* Keywords */}
        {node.keywords?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t.keywordsTitle}</h4>
            <div className="flex flex-wrap gap-1.5">
              {(node.keywords as string[]).map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-[#4c1d95]/20 text-[#a78bfa] border border-[#4c1d95]/15"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Similarity Edges */}
        {node.similarity_edges?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> {t.similarityTitle}
            </h4>
            <div className="space-y-1">
              {node.similarity_edges.slice(0, 5).map((edge, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-white/5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background:
                        edge.type === "strong" ? "#fbbf24" :
                        edge.type === "medium" ? "#a78bfa" : "#4c1d95",
                    }}
                  />
                  <span className="text-white/60 truncate flex-1">
                    {edge.target_url.split("/").pop() || edge.target_url}
                  </span>
                  <span className="text-white/40 font-mono shrink-0">{(edge.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
