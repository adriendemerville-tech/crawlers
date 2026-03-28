import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Brain, Network, Target, BarChart3, TrendingDown, GitMerge, ArrowLeftRight, Diff, AlertTriangle, Link2, DollarSign, Search, Sparkles, Building2, Play, Loader2, FileBarChart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AlgoConfig {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  icon: React.ElementType;
  trainingScore: number;
  dataRequirement: string;
  status: 'ready' | 'collecting' | 'risky';
  enabled: boolean;
  edgeFunction: string | null;
  metrics: { label: string; value: string }[];
}

const ALGOS: AlgoConfig[] = [
  {
    id: 'tfidf-cosine',
    name: 'TF-IDF + Cosine Similarity',
    description: 'Vectorisation déterministe des pages crawlées, clustering par composantes connexes. Moteur du module Cocoon.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: Network,
    trainingScore: 100,
    dataRequirement: 'crawl_pages',
    status: 'ready',
    enabled: true,
    edgeFunction: 'calculate-cocoon-logic',
    metrics: [
      { label: 'Type', value: 'Déterministe' },
      { label: 'Table', value: 'semantic_nodes' },
      { label: 'Cap', value: '100 pages' },
    ],
  },
  {
    id: 'internal-pagerank',
    name: 'PageRank Interne',
    description: 'Calcul itératif de PageRank (damping 0.85) sur le graphe de liens internes. Identifie les pages sous-liées à fort potentiel.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: Brain,
    trainingScore: 100,
    dataRequirement: 'crawl_pages.anchor_texts',
    status: 'ready',
    enabled: true,
    edgeFunction: 'calculate-internal-pagerank',
    metrics: [
      { label: 'Type', value: 'Déterministe' },
      { label: 'Convergence', value: '1e-6' },
      { label: 'Stockage', value: 'semantic_nodes.page_authority' },
    ],
  },
  {
    id: 'ias-score',
    name: 'Score IAS (Alignement Stratégique)',
    description: 'Ratio brand/generic sur les clics GSC. Mesure l\'alignement entre la stratégie de marque et le trafic organique réel.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: Target,
    trainingScore: 100,
    dataRequirement: 'gsc_history_log',
    status: 'ready',
    enabled: true,
    edgeFunction: 'calculate-ias',
    metrics: [
      { label: 'Type', value: 'Déterministe' },
      { label: 'Source', value: 'GSC clicks' },
      { label: 'Table', value: 'ias_history' },
    ],
  },
  {
    id: 'geo-score',
    name: 'Scoring GEO multi-LLM',
    description: 'Score de citabilité pondéré sur 6 LLMs (ChatGPT, Gemini, Perplexity, Claude, Mistral, Copilot). Mesure binaire fiable.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: BarChart3,
    trainingScore: 100,
    dataRequirement: 'llm_test_executions',
    status: 'ready',
    enabled: true,
    edgeFunction: 'check-geo',
    metrics: [
      { label: 'Type', value: 'Déterministe' },
      { label: 'LLMs', value: '6 modèles' },
      { label: 'Table', value: 'llm_visibility_snapshots' },
    ],
  },
  {
    id: 'content-decay',
    name: 'Content Decay Predictor',
    description: 'Régression temporelle sur fraîcheur + trafic pour prédire la perte de trafic. Nécessite 12+ semaines de données GSC.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: TrendingDown,
    trainingScore: 15,
    dataRequirement: 'gsc_history_log (12+ semaines)',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Régression' },
      { label: 'Min. data', value: '12 semaines' },
      { label: 'MAPE cible', value: '< 20%' },
    ],
  },
  {
    id: 'traffic-prediction',
    name: 'Triangle Prédictif (Trafic)',
    description: 'Prédiction de trafic post-optimisation via composite_gap GSC/GA4. Nécessite 50+ résultats réels pour calibration MAPE.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: BarChart3,
    trainingScore: 22,
    dataRequirement: 'actual_results (50+ entrées)',
    status: 'collecting',
    enabled: false,
    edgeFunction: 'generate-prediction',
    metrics: [
      { label: 'Type', value: 'Supervisé' },
      { label: 'Actuals', value: 'actual_results' },
      { label: 'MAPE actuel', value: 'En calibration' },
    ],
  },
  {
    id: 'cannibalization',
    name: 'Cannibalisation Auto-Resolver',
    description: 'Clustering NLP pour détecter les pages cannibalisantes (similarity > 0.85) et suggérer des fusions automatiques.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: GitMerge,
    trainingScore: 30,
    dataRequirement: 'semantic_nodes (similarity > 0.85)',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'NLP Clustering' },
      { label: 'Seuil', value: 'Cosine > 0.85' },
      { label: 'Table', value: 'semantic_nodes' },
    ],
  },
  {
    id: 'anomaly-detection',
    name: 'Anomaly Detection (Traffic/Rankings)',
    description: 'Détection automatique de chutes anormales de trafic, positions ou indexation via Z-score et Isolation Forest sur les séries temporelles GSC/GA4.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: AlertTriangle,
    trainingScore: 85,
    dataRequirement: 'gsc_history_log + ga4_history_log (8+ semaines)',
    status: 'ready',
    enabled: false,
    edgeFunction: 'detect-anomalies',
    metrics: [
      { label: 'Type', value: 'Z-score / IQR' },
      { label: 'Source', value: 'GSC + GA4' },
      { label: 'Alerting', value: 'Temps réel' },
    ],
  },
  {
    id: 'internal-link-optimizer',
    name: 'Internal Link Optimizer',
    description: 'Simulation de flux PageRank : prédit le gain d\'autorité de chaque lien interne ajouté. Recommande les liens à plus fort impact.',
    tier: 1,
    tierLabel: 'Déterministe',
    icon: Link2,
    trainingScore: 90,
    dataRequirement: 'semantic_nodes + crawl_pages.anchor_texts',
    status: 'ready',
    enabled: false,
    edgeFunction: 'optimize-internal-links',
    metrics: [
      { label: 'Type', value: 'Simulation PR' },
      { label: 'Algo', value: 'Delta PageRank' },
      { label: 'Output', value: 'Top 20 liens' },
    ],
  },
  {
    id: 'roi-predictor',
    name: 'ROI Predictor par Recommandation',
    description: 'Corrèle les recommandations appliquées avec le delta trafic/revenu réel à T+90. Prédit le ROI avant application.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: DollarSign,
    trainingScore: 10,
    dataRequirement: 'audit_impact_snapshots + cocoon_recommendations (20+ applied)',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Corrélation' },
      { label: 'Min. data', value: '20 recos appliquées' },
      { label: 'Source', value: 'impact_snapshots' },
    ],
  },
  {
    id: 'keyword-opportunity',
    name: 'Keyword Opportunity Scoring',
    description: 'Score multi-facteurs : écart entre position SERP et autorité du domaine. Identifie les mots-clés sous-exploités à fort potentiel.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: Search,
    trainingScore: 25,
    dataRequirement: 'serp_snapshots + backlink_snapshots + volumes LLM',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Scoring composite' },
      { label: 'Facteurs', value: 'Position × Autorité × Volume' },
      { label: 'Output', value: 'Top opportunités' },
    ],
  },
  {
    id: 'geo-citation-predictor',
    name: 'GEO Citation Predictor',
    description: 'Prédit quels attributs de contenu (longueur, schema.org, EEAT, structure) corrèlent avec un meilleur taux de citation LLM.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: Sparkles,
    trainingScore: 8,
    dataRequirement: 'llm_depth_conversations + crawl_pages (100+ pages testées)',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Feature importance' },
      { label: 'Min. data', value: '100 pages' },
      { label: 'Moat', value: 'First-mover GEO' },
    ],
  },
  {
    id: 'sector-benchmark',
    name: 'Benchmark Sectoriel',
    description: 'Percentile ranking par secteur d\'activité : compare les scores SEO, citation LLM et santé technique aux moyennes du secteur.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: Building2,
    trainingScore: 18,
    dataRequirement: 'analyzed_urls + audits (100+ domaines par secteur)',
    status: 'collecting',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Statistique' },
      { label: 'Min. data', value: '100 domaines/secteur' },
      { label: 'Output', value: 'Percentile rank' },
    ],
  },
  {
    id: 'content-perf-correlation',
    name: 'Content Performance Correlator',
    description: 'Corrèle les features de brief (ton, angle, longueur, H2, CTA, liens internes, passages GEO) avec les deltas GSC/GEO/LLM à T+30 et T+90. Agrégation anonyme cross-utilisateurs par page_type × market_sector.',
    tier: 2,
    tierLabel: 'Données 3-6 mois',
    icon: FileBarChart,
    trainingScore: 5,
    dataRequirement: 'content_generation_logs + gsc_weekly_snapshots + llm_visibility_snapshots (50+ générations complètes)',
    status: 'collecting',
    enabled: true,
    edgeFunction: 'content-perf-aggregator',
    metrics: [
      { label: 'Type', value: 'Corrélation cross-user' },
      { label: 'Cron', value: 'Hebdo lundi 3h UTC' },
      { label: 'Tables', value: 'content_generation_logs → content_performance_correlations' },
      { label: 'Confiance', value: 'A (≥20) / B (≥10) / C (≥5) / F (<5)' },
    ],
  },
  {
    id: 'intent-shift',
    name: 'Intent Shift Detector',
    description: 'Tracking longitudinal du type d\'intent sur les mêmes queries. Risque élevé de bruit dû à la volatilité SERP.',
    tier: 3,
    tierLabel: 'Risqué',
    icon: ArrowLeftRight,
    trainingScore: 5,
    dataRequirement: 'gsc_history_log + SERP tracking (6+ mois)',
    status: 'risky',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Longitudinal' },
      { label: 'Risque', value: 'Volatilité SERP' },
      { label: 'Min. data', value: '6 mois' },
    ],
  },
  {
    id: 'competitive-diff',
    name: 'Competitive Cocoon Diff',
    description: 'Comparaison de l\'architecture sémantique entre deux domaines concurrents. Problèmes de collecte de données fiables.',
    tier: 3,
    tierLabel: 'Risqué',
    icon: Diff,
    trainingScore: 3,
    dataRequirement: 'Crawl concurrent (non disponible)',
    status: 'risky',
    enabled: false,
    edgeFunction: null,
    metrics: [
      { label: 'Type', value: 'Comparatif' },
      { label: 'Risque', value: 'Données concurrents' },
      { label: 'Faisabilité', value: 'Faible' },
    ],
  },
];

const tierColors: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  2: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  3: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  ready: { label: 'Opérationnel', color: 'bg-emerald-500' },
  collecting: { label: 'Collecte en cours', color: 'bg-amber-500' },
  risky: { label: 'Non fiable', color: 'bg-red-500' },
};

function getProgressColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-emerald-500';
  if (score >= 40) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

export function AlgoTrainingDashboard() {
  const { language } = useLanguage();
  const [algos, setAlgos] = useState(ALGOS);

  const toggleAlgo = (id: string) => {
    setAlgos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  };

  const tier1 = algos.filter((a) => a.tier === 1);
  const tier2 = algos.filter((a) => a.tier === 2);
  const tier3 = algos.filter((a) => a.tier === 3);

  const avgScore = Math.round(algos.filter((a) => a.enabled).reduce((s, a) => s + a.trainingScore, 0) / Math.max(1, algos.filter((a) => a.enabled).length));

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground">Algos total</div>
            <div className="text-2xl font-bold mt-1">{algos.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground">Actifs</div>
            <div className="text-2xl font-bold mt-1">{algos.filter((a) => a.enabled).length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground">Score moyen</div>
            <div className="text-2xl font-bold mt-1">{avgScore}%</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground">Tier 1 (Fiables)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{tier1.filter((a) => a.enabled).length} / {tier1.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground">En collecte</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{algos.filter((a) => a.status === 'collecting').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tier 1 */}
      <div>
        <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Tier 1 — Déterministes &amp; Prêts
        </h3>
        <div className="space-y-3">
          {tier1.map((algo) => (
            <AlgoCard key={algo.id} algo={algo} onToggle={toggleAlgo} />
          ))}
        </div>
      </div>

      {/* Tier 2 */}
      <div>
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Tier 2 — En collecte de données (3-6 mois)
        </h3>
        <div className="space-y-3">
          {tier2.map((algo) => (
            <AlgoCard key={algo.id} algo={algo} onToggle={toggleAlgo} />
          ))}
        </div>
      </div>

      {/* Tier 3 */}
      <div>
        <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Tier 3 — Risqués / Non fiables
        </h3>
        <div className="space-y-3">
          {tier3.map((algo) => (
            <AlgoCard key={algo.id} algo={algo} onToggle={toggleAlgo} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlgoCard({ algo, onToggle }: { algo: AlgoConfig; onToggle: (id: string) => void }) {
  const Icon = algo.icon;
  const statusInfo = statusLabels[algo.status];

  return (
    <Card className={`border-border/50 transition-opacity ${!algo.enabled ? 'opacity-50' : ''}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="mt-0.5 p-2 rounded-lg bg-muted/50">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{algo.name}</h4>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierColors[algo.tier]}`}>
                Tier {algo.tier}
              </Badge>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`} />
                <span className="text-[10px] text-muted-foreground">{statusInfo.label}</span>
              </div>
              {algo.edgeFunction && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                  {algo.edgeFunction}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{algo.description}</p>

            {/* Training score bar */}
            <div className="flex items-center gap-3 mt-2.5">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap w-20">Entraînement</span>
              <Progress value={algo.trainingScore} className={`h-1.5 flex-1 ${getProgressColor(algo.trainingScore)}`} />
              <span className="text-xs font-mono font-medium w-10 text-right">{algo.trainingScore}%</span>
            </div>

            {/* Metrics pills */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {algo.metrics.map((m) => (
                <span key={m.label} className="text-[10px] bg-muted/50 rounded px-2 py-0.5 text-muted-foreground">
                  {m.label}: <span className="text-foreground font-medium">{m.value}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Toggle */}
          <div className="flex flex-col items-center gap-1 ml-2">
            <Switch
              checked={algo.enabled}
              onCheckedChange={() => onToggle(algo.id)}
              className="data-[state=checked]:bg-emerald-500"
            />
            <span className="text-[9px] text-muted-foreground">
              {algo.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
