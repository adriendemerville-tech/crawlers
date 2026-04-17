/**
 * GeoKpiBanner — bandeau de 7 KPIs GEO en haut de l'onglet GEO.
 * Source : edge function geo-kpis-aggregate (cache 1h dans geo_kpi_snapshots).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, Minus, Quote, Heart, Users, Bot, AlertTriangle, MousePointerClick, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeoKpiBannerProps {
  trackedSiteId: string;
}

interface GeoKpiData {
  geo_overall_score: number | null;
  geo_overall_delta: number | null;
  citation_rate: number | null;
  citation_rate_delta: number | null;
  avg_sentiment: number | null;
  recommendation_rate: number | null;
  share_of_voice: number | null;
  ai_requests_per_100_visits: number | null;
  url_hallucination_rate: number | null;
  ai_referral_ctr: number | null;
}

function formatNum(v: number | null, suffix = '', digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

function DeltaArrow({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined || Math.abs(delta) < 0.5) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  if (delta > 0) return <ArrowUp className="h-3 w-3 text-emerald-500" />;
  return <ArrowDown className="h-3 w-3 text-destructive" />;
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  loading?: boolean;
}

function Tile({ icon, label, value, delta, hint, loading }: TileProps) {
  return (
    <Card className="p-3 flex flex-col gap-1.5 border-border/60">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        {delta !== undefined && <DeltaArrow delta={delta ?? null} />}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      )}
      {hint && <div className="text-[10px] text-muted-foreground/80 truncate">{hint}</div>}
    </Card>
  );
}

export function GeoKpiBanner({ trackedSiteId }: GeoKpiBannerProps) {
  const [data, setData] = useState<GeoKpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    setLoading(true);
    supabase.functions
      .invoke('geo-kpis-aggregate', { body: { tracked_site_id: trackedSiteId } })
      .then(({ data: res, error }) => {
        if (error) console.error('geo-kpis-aggregate', error);
        if (res) setData(res as GeoKpiData);
        setLoading(false);
      });
  }, [trackedSiteId]);

  const sentiment = data?.avg_sentiment;
  const sentimentLabel =
    sentiment === null || sentiment === undefined
      ? '—'
      : sentiment > 0.2
      ? 'Positif'
      : sentiment < -0.2
      ? 'Négatif'
      : 'Neutre';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <Tile
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Score GEO"
        value={formatNum(data?.geo_overall_score ?? null, '/100')}
        delta={data?.geo_overall_delta ?? null}
        hint="vs baseline"
        loading={loading}
      />
      <Tile
        icon={<Quote className="h-3.5 w-3.5" />}
        label="Taux citation"
        value={formatNum(data?.citation_rate ?? null, '%', 1)}
        delta={data?.citation_rate_delta ?? null}
        hint="LLMs citant"
        loading={loading}
      />
      <Tile
        icon={<Heart className="h-3.5 w-3.5" />}
        label="Sentiment"
        value={sentimentLabel}
        hint={data?.recommendation_rate != null ? `${data.recommendation_rate.toFixed(0)}% reco.` : ''}
        loading={loading}
      />
      <Tile
        icon={<Users className="h-3.5 w-3.5" />}
        label="Part de voix"
        value={formatNum(data?.share_of_voice ?? null, '%', 0)}
        hint="vs concurrents"
        loading={loading}
      />
      <Tile
        icon={<Bot className="h-3.5 w-3.5" />}
        label="Bots IA / 100 visites"
        value={formatNum(data?.ai_requests_per_100_visits ?? null)}
        hint="bouclier requis"
        loading={loading}
      />
      <Tile
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="URLs hallucinées"
        value={formatNum(data?.url_hallucination_rate ?? null, '%', 1)}
        hint="LLMs inventent"
        loading={loading}
      />
      <Tile
        icon={<MousePointerClick className="h-3.5 w-3.5" />}
        label="CTR référent IA"
        value={formatNum(data?.ai_referral_ctr ?? null, '%', 2)}
        hint="ChatGPT, Perplexity…"
        loading={loading}
      />
    </div>
  );
}
