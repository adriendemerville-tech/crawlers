import { X, TrendingUp, Target, Globe, Zap, Link2 } from "lucide-react";

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
}

interface CocoonNodePanelProps {
  node: SemanticNode;
  onClose: () => void;
}

const INTENT_LABELS: Record<string, string> = {
  transactional: "Transactionnel",
  commercial: "Commercial",
  informational: "Informationnel",
  navigational: "Navigationnel",
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

export function CocoonNodePanel({ node, onClose }: CocoonNodePanelProps) {
  return (
    <div className="absolute top-4 right-4 bottom-4 w-[360px] rounded-xl bg-[#0f0a1e]/95 backdrop-blur-xl border border-[hsl(263,70%,20%)] overflow-y-auto z-20 animate-slide-in shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="sticky top-0 bg-[#0f0a1e]/90 backdrop-blur p-4 border-b border-[hsl(263,70%,20%)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#fbbf24] truncate">{node.title || node.url}</h3>
            <p className="text-xs text-white/40 truncate mt-0.5">{node.url}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#4c1d95]/50 text-[#a78bfa] border border-[#4c1d95]/30">
            {INTENT_LABELS[node.intent] || node.intent}
          </span>
          {node.cluster_id && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-white/50 border border-white/10">
              {node.cluster_id}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* ROI & Traffic */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-[#4c1d95]/30 to-[#4c1d95]/10 border border-[#4c1d95]/20">
            <TrendingUp className="w-4 h-4 text-[#fbbf24] mb-1" />
            <div className="text-lg font-bold text-white">{node.roi_predictive.toFixed(0)}€</div>
            <div className="text-[10px] text-white/40">ROI Prédictif / an</div>
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-[#4c1d95]/30 to-[#4c1d95]/10 border border-[#4c1d95]/20">
            <Zap className="w-4 h-4 text-[#fbbf24] mb-1" />
            <div className="text-lg font-bold text-white">{node.traffic_estimate}</div>
            <div className="text-[10px] text-white/40">Trafic estimé / mois</div>
          </div>
        </div>

        {/* Scores */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Scores STD</h4>
          <ScoreBadge value={node.iab_score} label="Iab (Anti-Wiki)" />
          <ScoreBadge value={node.geo_score} label="GEO Score" />
          <ScoreBadge value={node.citability_score} label="Citabilité LLM" />
          <ScoreBadge value={node.eeat_score} label="E-E-A-T" />
          <ScoreBadge value={node.freshness_score} label="Fraîcheur" />
          <ScoreBadge value={node.content_gap_score} label="Content Gap" />
          <ScoreBadge value={node.cannibalization_risk} label="Risque Cannibalisation" />
        </div>

        {/* SEO Metrics */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Métriques SEO</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">Volume</span>
              <span className="text-white font-mono">{node.search_volume}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">KD</span>
              <span className="text-white font-mono">{Math.round(node.keyword_difficulty)}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">CPC</span>
              <span className="text-white font-mono">{node.cpc_value.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-white/50">Mots</span>
              <span className="text-white font-mono">{node.internal_links_in + node.internal_links_out}</span>
            </div>
          </div>
        </div>

        {/* Internal Links */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Maillage
          </h4>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-white/50">Liens entrants : </span>
              <span className="text-[#fbbf24] font-mono">{node.internal_links_in}</span>
            </div>
            <div>
              <span className="text-white/50">Liens sortants : </span>
              <span className="text-[#a78bfa] font-mono">{node.internal_links_out}</span>
            </div>
          </div>
        </div>

        {/* Keywords */}
        {node.keywords?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Mots-clés</h4>
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
              <Globe className="w-3.5 h-3.5" /> Proximité sémantique
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
