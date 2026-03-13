import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, Activity, TrendingUp, TrendingDown, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

const CATEGORIES = [
  { id: 1, label: 'E-commerce & Retail', target: 30 },
  { id: 2, label: 'Média, Blog & Affiliation', target: 15 },
  { id: 3, label: 'Lead Gen B2B & Services', target: 40 },
  { id: 4, label: 'SaaS & Logiciel', target: 50 },
  { id: 5, label: 'Local & Brick-and-Mortar', target: 20 },
  { id: 6, label: 'Marque Statutaire / Luxe', target: 80 },
];

interface IASData {
  brand_name: string;
  category_id: number;
  category_label: string;
  target_ratio: number;
  actual_ratio: number;
  ias_score: number;
  brand_clicks: number;
  generic_clicks: number;
  total_clicks: number;
  brand_penetration_rate: number;
  search_volume: number | null;
}

interface IASCardProps {
  trackedSiteId: string;
  userId: string;
  domain: string;
  isPremium: boolean;
  onUpgrade?: () => void;
}

const translations = {
  fr: {
    title: 'Indice d\'Alignement Stratégique',
    subtitle: 'Marque vs Hors-Marque',
    healthScore: 'Score de santé',
    brandClicks: 'Clics Marque',
    genericClicks: 'Clics Génériques',
    targetRatio: 'Ratio cible',
    actualRatio: 'Ratio actuel',
    penetration: 'Taux de pénétration',
    category: 'Typologie',
    upgrade: 'Débloquer l\'IAS',
    upgradeDesc: 'Passez en Pro pour accéder au diagnostic stratégique.',
    noData: 'Aucune donnée GSC. Connectez Search Console pour activer l\'IAS.',
    loading: 'Calcul de l\'IAS…',
    recalculate: 'Recalculer',
  },
  en: {
    title: 'Strategic Alignment Index',
    subtitle: 'Brand vs Non-Brand',
    healthScore: 'Health Score',
    brandClicks: 'Brand Clicks',
    genericClicks: 'Generic Clicks',
    targetRatio: 'Target Ratio',
    actualRatio: 'Actual Ratio',
    penetration: 'Penetration Rate',
    category: 'Category',
    upgrade: 'Unlock IAS',
    upgradeDesc: 'Upgrade to Pro to access strategic diagnostic.',
    noData: 'No GSC data. Connect Search Console to activate IAS.',
    loading: 'Calculating IAS…',
    recalculate: 'Recalculate',
  },
  es: {
    title: 'Índice de Alineación Estratégica',
    subtitle: 'Marca vs No-Marca',
    healthScore: 'Puntuación de salud',
    brandClicks: 'Clics de Marca',
    genericClicks: 'Clics Genéricos',
    targetRatio: 'Ratio objetivo',
    actualRatio: 'Ratio actual',
    penetration: 'Tasa de penetración',
    category: 'Tipología',
    upgrade: 'Desbloquear IAS',
    upgradeDesc: 'Pase a Pro para acceder al diagnóstico estratégico.',
    noData: 'Sin datos GSC. Conecte Search Console para activar IAS.',
    loading: 'Calculando IAS…',
    recalculate: 'Recalcular',
  },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'hsl(var(--success))';
  if (score >= 75) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 90) return 'default';
  if (score >= 75) return 'secondary';
  return 'destructive';
}

export function IASCard({ trackedSiteId, userId, domain, isPremium, onUpgrade }: IASCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [data, setData] = useState<IASData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const fetchIAS = useCallback(async (forceCategoryId?: number) => {
    const isRecalc = !!forceCategoryId;
    if (isRecalc) setRecalculating(true);
    else setLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('calculate-ias', {
        body: {
          tracked_site_id: trackedSiteId,
          user_id: userId,
          ...(forceCategoryId ? { force_category_id: forceCategoryId } : {}),
        },
      });
      if (error) throw error;
      if (result && !result.error) setData(result);
    } catch (err) {
      console.error('IAS fetch error:', err);
    } finally {
      setLoading(false);
      setRecalculating(false);
    }
  }, [trackedSiteId, userId]);

  useEffect(() => { fetchIAS(); }, [fetchIAS]);

  const handleCategoryChange = (value: string) => {
    const catId = parseInt(value, 10);
    if (catId && !recalculating) fetchIAS(catId);
  };

  // Loading skeleton
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data || data.total_clicks === 0) {
    return (
      <Card className="border-dashed opacity-80">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>{t.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const gaugeData = [{ value: data.ias_score, fill: getScoreColor(data.ias_score) }];
  const brandPct = Math.round(data.actual_ratio * 100);
  const targetPct = Math.round(data.target_ratio * 100);

  const content = (
    <>
      {/* Radial gauge */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius="70%" outerRadius="100%"
              barSize={12}
              data={gaugeData}
              startAngle={225}
              endAngle={-45}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: 'hsl(var(--muted))' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color: getScoreColor(data.ias_score) }}>
              {data.ias_score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <Badge variant={getScoreBadgeVariant(data.ias_score)} className="text-xs">
          {t.healthScore}
        </Badge>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="text-xs text-muted-foreground">{t.brandClicks}</div>
          <p className="text-lg font-semibold text-primary">{data.brand_clicks.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">
            {brandPct}% — {t.targetRatio}: {targetPct}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="text-xs text-muted-foreground">{t.genericClicks}</div>
          <p className="text-lg font-semibold">{data.generic_clicks.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">
            {100 - brandPct}% — {t.targetRatio}: {100 - targetPct}%
          </p>
        </div>
      </div>

      {/* Ratio comparison bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t.actualRatio}: {brandPct}% / {100 - brandPct}%</span>
          <span>{t.targetRatio}: {targetPct}% / {100 - targetPct}%</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${brandPct}%`,
              background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
            }}
          />
          {/* Target marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/50"
            style={{ left: `${targetPct}%` }}
          />
        </div>
      </div>

      {/* Penetration rate */}
      {data.search_volume && data.search_volume > 0 && (
        <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{t.penetration}</div>
            <p className="text-sm font-semibold">
              {(data.brand_penetration_rate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <span className="font-medium text-foreground">{data.brand_name}</span>
            <br />
            Vol: {data.search_volume.toLocaleString()}/mois
          </div>
        </div>
      )}

      {/* Category selector (Pro only) */}
      {isPremium && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">{t.category}:</span>
          <Select
            value={String(data.category_id)}
            onValueChange={handleCategoryChange}
            disabled={recalculating}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)} className="text-xs">
                  {cat.label} ({cat.target}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fetchIAS()}
            disabled={recalculating}
          >
            {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t.title}
          <Badge variant="secondary" className="text-[10px] font-normal">{t.subtitle}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPremium ? (
          content
        ) : (
          <div className="relative">
            {/* Blurred content */}
            <div className="blur-md pointer-events-none select-none" aria-hidden>
              {content}
            </div>
            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/30 backdrop-blur-sm rounded-lg">
              <div className="h-12 w-12 rounded-full bg-[#7c3aed]/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-[#7c3aed]" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[200px]">{t.upgradeDesc}</p>
              <Button
                size="sm"
                className="bg-[#7c3aed] hover:bg-[#7c3aed]/90 text-white"
                onClick={onUpgrade}
              >
                {t.upgrade}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
