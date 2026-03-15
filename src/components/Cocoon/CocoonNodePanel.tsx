import { X, TrendingUp, Target, Globe, Zap, Link2, ExternalLink, Layers, FileText, Clock, Search, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

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

export function CocoonNodePanel({ node, onClose, onRefresh, onAuditLaunch, isWaitingAudit }: CocoonNodePanelProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = i18n[language] || i18n.fr;

  const depthLabel = (t.depths as Record<number, string>)[node.crawl_depth ?? 0] ||
    `${t.depths[1]}${"⁴⁵⁶⁷⁸⁹"[(node.crawl_depth ?? 4) - 4] || `^${node.crawl_depth}`}`;
  const pageTypeLabel = (t.pageTypes as Record<string, string>)[node.page_type || "unknown"] || t.pageTypes.unknown;
  const pageTypeColor = PAGE_TYPE_COLORS[node.page_type || "unknown"] || PAGE_TYPE_COLORS.unknown;
  const intentLabel = (t.intents as Record<string, string>)[node.intent] || node.intent;

  return (
    <div className="absolute top-4 right-4 bottom-4 w-[360px] rounded-xl bg-[#0f0a1e]/95 backdrop-blur-xl border border-[hsl(263,70%,20%)] overflow-y-auto z-20 animate-slide-in shadow-2xl shadow-black/40">
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
                <RefreshCw className="w-4 h-4 animate-spin text-[#60a5fa]" />
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

        {/* Waiting for audit */}
        {isWaitingAudit && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#60a5fa] animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {language === 'en' ? 'Waiting for audit results…' : language === 'es' ? 'Esperando resultados…' : 'En attente des résultats…'}
          </div>
        )}

        {/* Last updated */}
        {node.page_updated_at && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/40">
            <Clock className="w-3 h-3" />
            {t.lastUpdated} : {formatDate(node.page_updated_at, language)}
          </div>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* ROI & Traffic — hidden for now
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-[#4c1d95]/30 to-[#4c1d95]/10 border border-[#4c1d95]/20">
            <TrendingUp className="w-4 h-4 text-[#fbbf24] mb-1" />
            <div className="text-lg font-bold text-white">{node.roi_predictive.toFixed(0)}€</div>
            <div className="text-[10px] text-white/40">{t.roiLabel}</div>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-[#4c1d95]/30 to-[#4c1d95]/10 border border-[#4c1d95]/20">
            <Zap className="w-4 h-4 text-[#fbbf24] mb-1" />
            <div className="text-lg font-bold text-white">{node.traffic_estimate}</div>
            <div className="text-[10px] text-white/40">{t.trafficLabel}</div>
          </div>
        </div>
        */}

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