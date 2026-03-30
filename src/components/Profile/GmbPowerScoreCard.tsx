import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';

const translations = {
  fr: {
    title: 'Score de Puissance GMB',
    evolution: 'Évolution du score',
    dimensions: 'Dimensions',
    completeness: 'Complétude',
    reputation: 'Réputation',
    activity: 'Activité',
    localSerp: 'SERP Local',
    nap: 'Cohérence NAP',
    media: 'Médias',
    trust: 'Confiance',
    noData: 'Aucun snapshot disponible. Lancez un scan GMB pour calculer votre score.',
    week: 'Sem.',
  },
  en: {
    title: 'GMB Power Score',
    evolution: 'Score evolution',
    dimensions: 'Dimensions',
    completeness: 'Completeness',
    reputation: 'Reputation',
    activity: 'Activity',
    localSerp: 'Local SERP',
    nap: 'NAP Consistency',
    media: 'Media',
    trust: 'Trust',
    noData: 'No snapshot available. Run a GMB scan to compute your score.',
    week: 'Wk.',
  },
  es: {
    title: 'Score de Potencia GMB',
    evolution: 'Evolución del score',
    dimensions: 'Dimensiones',
    completeness: 'Completitud',
    reputation: 'Reputación',
    activity: 'Actividad',
    localSerp: 'SERP Local',
    nap: 'Coherencia NAP',
    media: 'Medios',
    trust: 'Confianza',
    noData: 'Sin snapshot disponible. Lance un escaneo GMB para calcular su score.',
    week: 'Sem.',
  },
};

interface Snapshot {
  id: string;
  total_score: number;
  grade: string;
  completeness_score: number;
  reputation_score: number;
  activity_score: number;
  local_serp_score: number;
  nap_consistency_score: number;
  media_score: number;
  trust_score: number;
  week_start_date: string;
  measured_at: string;
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald-600 dark:text-emerald-400';
  if (grade === 'B') return 'text-primary';
  if (grade === 'C') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

function gradeBg(grade: string): string {
  if (grade.startsWith('A')) return 'bg-emerald-500/10 border-emerald-500/30';
  if (grade === 'B') return 'bg-primary/10 border-primary/30';
  if (grade === 'C') return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-destructive/10 border-destructive/30';
}

interface Props {
  trackedSiteId: string | null;
}

export function GmbPowerScoreCard({ trackedSiteId }: Props) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) { setLoading(false); return; }

    const fetchSnapshots = async () => {
      const { data } = await supabase
        .from('gmb_power_snapshots')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .order('measured_at', { ascending: true })
        .limit(24);

      setSnapshots((data as any[]) ?? []);
      setLoading(false);
    };

    fetchSnapshots();

    // Realtime subscription
    const channel = supabase
      .channel(`gmb-power-${trackedSiteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gmb_power_snapshots',
        filter: `tracked_site_id=eq.${trackedSiteId}`,
      }, () => fetchSnapshots())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [trackedSiteId]);

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">
          <div className="animate-pulse">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const delta = latest && previous ? latest.total_score - previous.total_score : null;

  // Radar data
  const radarData = latest ? [
    { dim: t.completeness, value: latest.completeness_score, fullMark: 100 },
    { dim: t.reputation, value: latest.reputation_score, fullMark: 100 },
    { dim: t.activity, value: latest.activity_score, fullMark: 100 },
    { dim: t.localSerp, value: latest.local_serp_score, fullMark: 100 },
    { dim: t.nap, value: latest.nap_consistency_score, fullMark: 100 },
    { dim: t.media, value: latest.media_score, fullMark: 100 },
    { dim: t.trust, value: latest.trust_score, fullMark: 100 },
  ] : [];

  // Timeline data
  const timelineData = snapshots.map(s => ({
    week: s.week_start_date.slice(5), // MM-DD
    score: s.total_score,
    grade: s.grade,
  }));

  if (!latest) {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.noData}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4.5 w-4.5 text-primary" />
          </div>
          {t.title}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Score composite basé sur 7 dimensions : complétude, réputation, activité, SERP local, cohérence NAP, médias et confiance.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Score principal */}
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-xl border ${gradeBg(latest.grade)}`}>
            <span className={`text-2xl font-bold ${gradeColor(latest.grade)}`}>{latest.total_score}</span>
          </div>
          <div>
            <Badge variant="outline" className={`text-sm font-bold ${gradeColor(latest.grade)}`}>
              {latest.grade}
            </Badge>
            {delta !== null && delta !== 0 && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${delta > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta > 0 ? '+' : ''}{delta} pts
              </div>
            )}
            {delta === 0 && (
              <div className="flex items-center gap-1 text-xs mt-1 text-muted-foreground">
                <Minus className="h-3 w-3" /> Stable
              </div>
            )}
          </div>

          {/* Mini dimensions list */}
          <div className="ml-auto grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {radarData.map(d => (
              <div key={d.dim} className="flex justify-between gap-2">
                <span>{d.dim}</span>
                <span className="font-medium text-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Evolution timeline */}
        {timelineData.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t.evolution}</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value}/100`, 'Score']}
                  />
                  <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
