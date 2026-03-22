import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Link2, Layers, AlertTriangle, Network, Info, Box, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface MaillageData {
  /** Overall health score 0-100 */
  healthScore: number;
  /** Link density as percentage (existing / possible links) */
  linkDensity: number;
  /** Max click depth from homepage */
  maxDepth: number;
  /** Number of orphan pages (0 incoming links) */
  orphanPages: number;
  /** Total pages analyzed */
  totalPages: number;
  /** PageRank distribution buckets */
  prDistribution: {
    label: string;
    percentage: number;
    pageCount: number;
  }[];
}

interface Props {
  data: MaillageData;
  onExploreCocoon?: () => void;
}

// ══════════════════════════════════════════════════════════════
// TRANSLATIONS
// ══════════════════════════════════════════════════════════════

const translations = {
  fr: {
    title: 'Analyse du Maillage Interne (IPR)',
    subtitle: 'Distribution du PageRank et santé structurelle',
    excellent: 'Excellent',
    good: 'Bon',
    optimize: 'À optimiser',
    critical: 'Critique',
    density: 'Densité du maillage',
    densityTooltip: 'Ratio entre les liens existants et les liens possibles. Une densité optimale se situe entre 5% et 15% pour éviter la dilution du jus SEO.',
    maxDepth: 'Profondeur max',
    clicks: 'clics',
    orphans: 'Pages orphelines',
    orphansZero: 'Aucune',
    prTitle: 'Répartition du PageRank',
    prConcentration: 'concentrent',
    prOf: 'du PageRank',
    pages: 'pages',
    explore: 'Explorer dans le Cocoon 3D',
    healthLabel: 'Score de santé',
  },
  en: {
    title: 'Internal Linking Analysis (IPR)',
    subtitle: 'PageRank distribution & structural health',
    excellent: 'Excellent',
    good: 'Good',
    optimize: 'Needs optimization',
    critical: 'Critical',
    density: 'Link density',
    densityTooltip: 'Ratio of existing links vs possible links. Optimal density is between 5% and 15% to avoid SEO juice dilution.',
    maxDepth: 'Max depth',
    clicks: 'clicks',
    orphans: 'Orphan pages',
    orphansZero: 'None',
    prTitle: 'PageRank distribution',
    prConcentration: 'concentrate',
    prOf: 'of PageRank',
    pages: 'pages',
    explore: 'Explore in Cocoon 3D',
    healthLabel: 'Health score',
  },
  es: {
    title: 'Análisis del Enlazado Interno (IPR)',
    subtitle: 'Distribución del PageRank y salud estructural',
    excellent: 'Excelente',
    good: 'Bueno',
    optimize: 'A optimizar',
    critical: 'Crítico',
    density: 'Densidad de enlaces',
    densityTooltip: 'Ratio entre los enlaces existentes y los posibles. Una densidad óptima está entre 5% y 15%.',
    maxDepth: 'Profundidad máx',
    clicks: 'clics',
    orphans: 'Páginas huérfanas',
    orphansZero: 'Ninguna',
    prTitle: 'Distribución del PageRank',
    prConcentration: 'concentran',
    prOf: 'del PageRank',
    pages: 'páginas',
    explore: 'Explorar en Cocoon 3D',
    healthLabel: 'Puntuación de salud',
  },
};

// ══════════════════════════════════════════════════════════════
// HEALTH GAUGE
// ══════════════════════════════════════════════════════════════

function HealthGauge({ score, label, sublabel }: { score: number; label: string; sublabel: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80
    ? 'hsl(var(--chart-2))' // green-ish
    : score >= 60
      ? 'hsl(var(--chart-4))' // yellow-ish
      : 'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{score}%</span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className={
          score >= 80
            ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
            : score >= 60
              ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
              : 'border-destructive/30 text-destructive bg-destructive/5'
        }
      >
        {sublabel}
      </Badge>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// KPI METRIC
// ══════════════════════════════════════════════════════════════

function KPIMetric({
  icon,
  label,
  value,
  suffix,
  alert,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  alert?: boolean;
  tooltip?: string;
}) {
  const content = (
    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${alert ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 bg-muted/30'}`}>
      <div className={`${alert ? 'text-destructive' : 'text-muted-foreground'}`}>{icon}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-semibold ${alert ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <span className="text-[11px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );

  if (!tooltip) return content;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-relaxed">
          <div className="flex gap-1.5 items-start">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <p>{tooltip}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ══════════════════════════════════════════════════════════════
// PR DISTRIBUTION BAR CHART
// ══════════════════════════════════════════════════════════════

function PRDistributionChart({
  distribution,
  concentrationLabel,
  ofLabel,
  pagesLabel,
}: {
  distribution: MaillageData['prDistribution'];
  concentrationLabel: string;
  ofLabel: string;
  pagesLabel: string;
}) {
  const maxPct = Math.max(...distribution.map(d => d.percentage), 1);

  const barColors = [
    'bg-primary',
    'bg-primary/70',
    'bg-primary/50',
    'bg-primary/30',
    'bg-muted-foreground/20',
  ];

  return (
    <div className="space-y-2">
      {distribution.map((bucket, i) => (
        <div key={bucket.label} className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-20 text-right shrink-0">{bucket.label}</span>
          <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden relative">
            <motion.div
              className={`h-full rounded-full ${barColors[i] || barColors[barColors.length - 1]}`}
              initial={{ width: 0 }}
              animate={{ width: `${(bucket.percentage / maxPct) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
            <span className="absolute right-2 top-0.5 text-[10px] font-medium text-foreground/70">
              {(bucket.percentage ?? 0).toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground w-16 shrink-0">
            {bucket.pageCount} {pagesLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function MaillageIPRCard({ data, onExploreCocoon }: Props) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const healthSublabel = useMemo(() => {
    if (data.healthScore >= 80) return t.excellent;
    if (data.healthScore >= 60) return t.good;
    if (data.healthScore >= 40) return t.optimize;
    return t.critical;
  }, [data.healthScore, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Score + KPIs Row ── */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Health Gauge */}
            <HealthGauge
              score={data.healthScore}
              label={t.healthLabel}
              sublabel={healthSublabel}
            />

            {/* 3 KPIs */}
            <div className="flex-1 grid grid-cols-3 gap-3 w-full">
              <KPIMetric
                icon={<Link2 className="w-4 h-4" />}
                label={t.density}
                value={`${data.linkDensity.toFixed(1)}%`}
                tooltip={t.densityTooltip}
                alert={data.linkDensity < 3 || data.linkDensity > 20}
              />
              <KPIMetric
                icon={<Layers className="w-4 h-4" />}
                label={t.maxDepth}
                value={data.maxDepth}
                suffix={t.clicks}
                alert={data.maxDepth > 4}
              />
              <KPIMetric
                icon={<AlertTriangle className="w-4 h-4" />}
                label={t.orphans}
                value={data.orphanPages > 0 ? data.orphanPages : t.orphansZero}
                suffix={data.orphanPages > 0 ? t.pages : undefined}
                alert={data.orphanPages > 0}
              />
            </div>
          </div>

          {/* ── PR Distribution ── */}
          {data.prDistribution.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{t.prTitle}</span>
              </div>
              <PRDistributionChart
                distribution={data.prDistribution}
                concentrationLabel={t.prConcentration}
                ofLabel={t.prOf}
                pagesLabel={t.pages}
              />
            </div>
          )}

          {/* ── CTA ── */}
          {onExploreCocoon && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onExploreCocoon}
                className="gap-2 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t.explore}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// UTILITY: Compute MaillageData from semantic_nodes
// ══════════════════════════════════════════════════════════════

export function computeMaillageData(nodes: any[]): MaillageData | null {
  if (!nodes || nodes.length === 0) return null;

  const n = nodes.length;

  // Link density
  const totalEdges = nodes.reduce((sum, nd) => sum + (nd.similarity_edges?.length || 0), 0);
  const maxPossible = n * (n - 1);
  const linkDensity = maxPossible > 0 ? (totalEdges / maxPossible) * 100 : 0;

  // Max depth
  const maxDepth = Math.max(...nodes.map(nd => nd.depth ?? 0), 0);

  // Orphan pages (0 incoming links)
  const orphanPages = nodes.filter(nd => (nd.internal_links_in ?? 0) === 0 && nd.depth > 0).length;

  // PageRank distribution buckets
  const authorities = nodes
    .map(nd => nd.page_authority ?? 0)
    .sort((a, b) => b - a);

  const totalAuthority = authorities.reduce((s, v) => s + v, 0) || 1;

  const buckets = [
    { label: 'Top 10%', start: 0, end: Math.ceil(n * 0.1) },
    { label: 'Top 10-25%', start: Math.ceil(n * 0.1), end: Math.ceil(n * 0.25) },
    { label: 'Top 25-50%', start: Math.ceil(n * 0.25), end: Math.ceil(n * 0.5) },
    { label: 'Top 50-75%', start: Math.ceil(n * 0.5), end: Math.ceil(n * 0.75) },
    { label: 'Bottom 25%', start: Math.ceil(n * 0.75), end: n },
  ];

  const prDistribution = buckets
    .filter(b => b.start < n)
    .map(b => {
      const slice = authorities.slice(b.start, b.end);
      const bucketSum = slice.reduce((s, v) => s + v, 0);
      return {
        label: b.label,
        percentage: (bucketSum / totalAuthority) * 100,
        pageCount: slice.length,
      };
    });

  // Health score computation
  let healthScore = 50;
  // Density bonus (optimal 5-15%)
  if (linkDensity >= 5 && linkDensity <= 15) healthScore += 20;
  else if (linkDensity >= 3 && linkDensity <= 20) healthScore += 10;
  // Depth bonus (optimal ≤ 3)
  if (maxDepth <= 3) healthScore += 15;
  else if (maxDepth <= 4) healthScore += 8;
  // Orphan penalty
  const orphanRatio = orphanPages / n;
  if (orphanRatio === 0) healthScore += 15;
  else if (orphanRatio < 0.05) healthScore += 8;
  else healthScore -= 10;
  // PR distribution balance (top 10% should NOT have > 90%)
  const top10Pct = prDistribution[0]?.percentage ?? 0;
  if (top10Pct < 70) healthScore += 10;
  else if (top10Pct < 85) healthScore += 5;

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return {
    healthScore,
    linkDensity,
    maxDepth,
    orphanPages,
    totalPages: n,
    prDistribution,
  };
}
